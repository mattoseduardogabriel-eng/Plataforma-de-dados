import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TwoFactorService } from './two-factor.service';
import * as totpUtil from '../../common/utils/totp.util';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let prisma: any;
  let cipher: any;
  let auditService: any;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    prisma = { user: { findUniqueOrThrow: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
    cipher = { encrypt: jest.fn((v: string) => `enc:${v}`), decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')) };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new TwoFactorService(prisma, cipher, auditService);
  });

  describe('setup', () => {
    it('gera um segredo novo, cifra e grava, devolve QR code e otpauthUrl', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: false });

      const resultado = await service.setup(userId, 'admin@empresa.com');

      expect(resultado.secret).toMatch(/^[A-Z2-7]+$/);
      expect(resultado.otpauthUrl).toContain('admin%40empresa.com');
      expect(resultado.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { twoFactorSecret: `enc:${resultado.secret}` },
      });
    });

    it('recusa gerar um QR novo se o 2FA já está ativado', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: true });
      await expect(service.setup(userId, 'admin@empresa.com')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enable', () => {
    it('liga a exigência quando o código confere com o segredo salvo', async () => {
      const secret = totpUtil.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: false, twoFactorSecret: `enc:${secret}` });
      const token = totpUtil.generateToken(secret);

      const resultado = await service.enable(userId, orgId, token);

      expect(resultado.enabled).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { twoFactorEnabled: true } });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TWO_FACTOR_ENABLED' }));
    });

    it('rejeita um código errado, sem ligar a exigência', async () => {
      const secret = totpUtil.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: false, twoFactorSecret: `enc:${secret}` });

      await expect(service.enable(userId, orgId, '000000')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('recusa confirmar sem ter chamado setup() antes', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: false, twoFactorSecret: null });
      await expect(service.enable(userId, orgId, '123456')).rejects.toThrow(BadRequestException);
    });
  });

  describe('disable', () => {
    it('desativa com um código TOTP válido', async () => {
      const secret = totpUtil.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: true, twoFactorSecret: `enc:${secret}`, passwordHash: 'hash' });
      const token = totpUtil.generateToken(secret);

      const resultado = await service.disable(userId, orgId, token, undefined);

      expect(resultado.enabled).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });
    });

    it('desativa com a senha certa, mesmo sem o código (perdeu o celular)', async () => {
      const senhaHash = await bcrypt.hash('MinhaSenh@123', 10);
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        twoFactorEnabled: true,
        twoFactorSecret: `enc:${totpUtil.generateSecret()}`,
        passwordHash: senhaHash,
      });

      const resultado = await service.disable(userId, orgId, undefined, 'MinhaSenh@123');

      expect(resultado.enabled).toBe(false);
    });

    it('rejeita quando nem o código nem a senha conferem', async () => {
      const senhaHash = await bcrypt.hash('MinhaSenh@123', 10);
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        twoFactorEnabled: true,
        twoFactorSecret: `enc:${totpUtil.generateSecret()}`,
        passwordHash: senhaHash,
      });

      await expect(service.disable(userId, orgId, '000000', 'senha-errada')).rejects.toThrow(BadRequestException);
    });

    it('recusa desativar quando o 2FA já não está ativado', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: userId, twoFactorEnabled: false });
      await expect(service.disable(userId, orgId, undefined, undefined)).rejects.toThrow(BadRequestException);
    });
  });
});
