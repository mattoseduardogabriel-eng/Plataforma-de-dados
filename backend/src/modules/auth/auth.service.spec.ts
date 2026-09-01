import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let auditService: any;

  const activeUser = {
    id: 'user-1',
    email: 'ana@franquiademo.com.br',
    role: 'ADMIN',
    organizationId: 'org-1',
    active: true,
    tokenVersion: 0,
    passwordHash: '',
  };

  beforeAll(async () => {
    activeUser.passwordHash = await bcrypt.hash('Demo@123456', 10);
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    configService = { get: jest.fn(() => 'test-secret') };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(prisma, jwtService, configService, auditService);
  });

  describe('validateCredentials', () => {
    it('retorna o usuário quando a senha confere', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const user = await service.validateCredentials(activeUser.email, 'Demo@123456');
      expect(user.id).toBe(activeUser.id);
    });

    it('lança UnauthorizedException para senha incorreta', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      await expect(service.validateCredentials(activeUser.email, 'senha-errada')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException para usuário inexistente', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.validateCredentials('naoexiste@x.com', 'qualquer')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException para usuário inativo', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, active: false });
      await expect(service.validateCredentials(activeUser.email, 'Demo@123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('gera tokens e registra auditoria de LOGIN', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const result = await service.login({ email: activeUser.email, password: 'Demo@123456' });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe(activeUser.email);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: activeUser.id } }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', organizationId: activeUser.organizationId }),
      );
    });
  });

  describe('refresh', () => {
    it('rejeita quando o tokenVersion não confere (sessão revogada)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: activeUser.id, tokenVersion: 5 });
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, tokenVersion: 0, hashedRefreshToken: 'x' });

      await expect(service.refresh('some-refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita quando o JWT do refresh é inválido', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
      await expect(service.refresh('token-invalido')).rejects.toThrow(UnauthorizedException);
    });
  });
});
