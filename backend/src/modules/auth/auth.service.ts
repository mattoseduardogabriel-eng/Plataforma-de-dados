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

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
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
        data: { name: dto.organizationName, cnpj: dto.organizationCnpj },
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

    return this.login({ email: dto.email, password: dto.password });
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { active: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (!user.organization.active) {
      throw new UnauthorizedException('Esta empresa está suspensa. Entre em contato com o suporte.');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateCredentials(dto.email, dto.password);
    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

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
        organization: { select: { id: true, name: true, cnpj: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
