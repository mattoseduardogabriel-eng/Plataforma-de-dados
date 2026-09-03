import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { SecretCipher } from '../../common/crypto/secret-cipher';
import * as totp from '../../common/utils/totp.util';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly cipher: SecretCipher,
  ) {}

  private async signTokens(user: {
    id: string;
    email: string;
    role: Role;
    organizationId: string;
    tokenVersion: number;
  }) {
    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = await this.jwtService.signAsync(basePayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenVersion: user.tokenVersion },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  async registerOrganization(dto: RegisterOrganizationDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const { organization, user } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          cnpj: dto.organizationCnpj,
          // Auto-cadastro fica pendente até o dono da plataforma aprovar
          // (ver BackofficeService.decideApproval) — sem login até lá.
          approvalStatus: 'PENDING',
          subscriptionStatus: 'TRIAL',
        },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: Role.ADMIN,
        },
      });
      const pipeline = await tx.pipeline.create({
        data: {
          organizationId: organization.id,
          name: 'Funil de Vendas',
          isDefault: true,
          stages: {
            create: [
              { name: 'Novo Contato', order: 1, colorHex: '#94a3b8' },
              { name: 'Qualificação', order: 2, colorHex: '#38bdf8' },
              { name: 'Proposta Enviada', order: 3, colorHex: '#a78bfa' },
              { name: 'Negociação', order: 4, colorHex: '#fbbf24' },
              { name: 'Fechado — Ganho', order: 5, colorHex: '#22c55e', isWon: true },
              { name: 'Fechado — Perdido', order: 6, colorHex: '#ef4444', isLost: true },
            ],
          },
        },
      });
      await tx.creditPolicy.create({
        data: {
          organizationId: organization.id,
          name: 'Política Padrão',
          active: true,
          isDefault: true,
        },
      });
      return { organization, user, pipeline };
    });

    await this.auditService.log({
      organizationId: organization.id,
      userId: user.id,
      action: 'REGISTER_ORGANIZATION',
      entityType: 'Organization',
      entityId: organization.id,
    });

    // Não faz login automático: a empresa entra como PENDING e só pode
    // acessar depois que o dono da plataforma aprovar o cadastro.
    return {
      pendingApproval: true as const,
      message: 'Cadastro enviado! Assim que for aprovado, você poderá entrar normalmente.',
    };
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: {
            active: true,
            approvalStatus: true,
            rejectionReason: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Só revela o motivo do bloqueio depois de confirmar a senha (evita
    // vazar o status da empresa pra quem não tem a credencial certa).
    const org = user.organization;
    if (org.approvalStatus === 'PENDING') {
      throw new UnauthorizedException(
        'Seu cadastro ainda está em análise. Você poderá entrar assim que for aprovado.',
      );
    }
    if (org.approvalStatus === 'REJECTED') {
      throw new UnauthorizedException(
        org.rejectionReason
          ? `Cadastro não aprovado: ${org.rejectionReason}`
          : 'Cadastro não aprovado. Entre em contato com o suporte.',
      );
    }
    if (!org.active) {
      throw new UnauthorizedException('Esta empresa está suspensa. Entre em contato com o suporte.');
    }
    if (org.subscriptionStatus === 'CANCELED') {
      throw new UnauthorizedException('A assinatura desta empresa foi cancelada. Entre em contato com o suporte.');
    }
    if (org.subscriptionStatus === 'TRIAL' && org.trialEndsAt && org.trialEndsAt.getTime() < Date.now()) {
      throw new UnauthorizedException('O período de teste desta empresa expirou. Entre em contato para assinar.');
    }

    return user;
  }

  // Token intermediário de 2FA — carrega só "essa pessoa já provou a
  // senha, falta o código" (pending2FA: true), curta duração (5min: se
  // não digitar o código a tempo, refaz o login do zero). Assinado com o
  // mesmo JWT_ACCESS_SECRET (JwtStrategy.validate rejeita
  // explicitamente qualquer payload com pending2FA — ver o comentário
  // lá), então nunca serve pra acessar rota nenhuma da API.
  private async signPendingTwoFactorToken(userId: string, organizationId: string) {
    return this.jwtService.signAsync(
      { sub: userId, organizationId, pending2FA: true },
      { secret: this.configService.get<string>('JWT_ACCESS_SECRET'), expiresIn: '5m' },
    );
  }

  private buildLoginResponse(user: { id: string; name: string; email: string; role: Role; organizationId: string }, tokens: { accessToken: string; refreshToken: string }) {
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.validateCredentials(dto.email, dto.password);

    // Senha certa, mas 2FA ligado: não entrega o token de acesso ainda —
    // devolve um token intermediário só pra completar em POST /auth/login/2fa.
    if (user.twoFactorEnabled) {
      return { twoFactorRequired: true as const, pendingToken: await this.signPendingTwoFactorToken(user.id, user.organizationId) };
    }

    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return this.buildLoginResponse(user, tokens);
  }

  // Segunda etapa do login quando a conta tem 2FA ligado — troca o token
  // intermediário (que já prova que a senha estava certa) + o código do
  // app autenticador pelo token de acesso de verdade.
  async loginTwoFactor(pendingToken: string, token: string) {
    let payload: { sub: string; organizationId: string; pending2FA?: boolean };
    try {
      payload = await this.jwtService.verifyAsync(pendingToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sessão de login expirada. Faça login de novo.');
    }
    if (!payload.pending2FA) {
      throw new UnauthorizedException('Token inválido pra essa etapa.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const secret = this.cipher.decrypt(user.twoFactorSecret);
    if (!totp.verifyToken(secret, token)) {
      throw new UnauthorizedException('Código inválido ou expirado.');
    }

    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return this.buildLoginResponse(user, tokens);
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; tokenVersion: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (
      !user ||
      !user.active ||
      !user.hashedRefreshToken ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Sessão inválida, faça login novamente.');
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Sessão inválida, faça login novamente.');
    }

    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null, tokenVersion: { increment: 1 } },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        active: true,
        createdAt: true,
        hiddenDashboardWidgets: true,
        organization: { select: { id: true, name: true, cnpj: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      // Derruba as outras sessões (tokenVersion) — só quem digitou a senha
      // nova continua logado.
      data: { passwordHash, hashedRefreshToken: null, tokenVersion: { increment: 1 } },
    });
    await this.auditService.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
    });
    return { success: true };
  }
}
