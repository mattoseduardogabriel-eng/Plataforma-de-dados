import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SecretCipher } from '../../common/crypto/secret-cipher';
import { AuditService } from '../audit/audit.service';
import * as totp from '../../common/utils/totp.util';

/**
 * 2FA (TOTP) — só ADMIN/GESTOR (ver two-factor.controller.ts, mesmo nível
 * de acesso de configuração sensível da empresa). Segredo cifrado desde o
 * momento em que é gerado; só passa a EXIGIR o código no login depois de
 * confirmar um código válido (ver enable()).
 */
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
    private readonly auditService: AuditService,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: user.twoFactorEnabled };
  }

  // Gera um segredo novo e devolve o QR code pra escanear — NÃO liga a
  // exigência ainda. Chamar de novo antes de confirmar substitui o
  // segredo anterior (não deixa segredo órfão acumulando).
  async setup(userId: string, email: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA já está ativado. Desative antes de gerar um novo QR code.');
    }

    const secret = totp.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: this.cipher.encrypt(secret) } });

    const otpauthUrl = totp.keyUri(secret, email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  // Confirma o código gerado pelo app autenticador e SÓ ENTÃO liga a
  // exigência de 2FA no login.
  async enable(userId: string, organizationId: string, token: string | undefined) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Gere o QR code (POST /2fa/setup) antes de confirmar.');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA já está ativado.');
    }

    const secret = this.cipher.decrypt(user.twoFactorSecret);
    if (!totp.verifyToken(secret, token)) {
      throw new BadRequestException('Código inválido ou expirado. Confira o horário do celular e tente de novo.');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await this.auditService.log({
      organizationId,
      userId,
      action: 'TWO_FACTOR_ENABLED',
      entityType: 'User',
      entityId: userId,
    });

    return { enabled: true };
  }

  // Exige o código TOTP OU a senha (não só um dos dois sempre
  // disponível: perder o celular com o app autenticador não pode
  // significar ficar trancado pra sempre fora da própria conta, desde
  // que ainda saiba a senha).
  async disable(userId: string, organizationId: string, token: string | undefined, password: string | undefined) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA não está ativado.');
    }

    const secret = user.twoFactorSecret ? this.cipher.decrypt(user.twoFactorSecret) : null;
    const tokenValido = !!secret && totp.verifyToken(secret, token);
    const senhaValida = !!password && (await bcrypt.compare(password, user.passwordHash));

    if (!tokenValido && !senhaValida) {
      throw new BadRequestException('Informe o código do app autenticador ou sua senha pra confirmar.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await this.auditService.log({
      organizationId,
      userId,
      action: 'TWO_FACTOR_DISABLED',
      entityType: 'User',
      entityId: userId,
    });

    return { enabled: false };
  }
}
