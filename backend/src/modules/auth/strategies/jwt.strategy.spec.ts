import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy({ get: () => 'test-secret' } as any);
  });

  it('rejeita um payload com pending2FA — nunca dá acesso à API antes de completar o 2FA', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1', pending2FA: true }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('aceita um payload normal (sem pending2FA)', async () => {
    const user = await strategy.validate({ sub: 'user-1', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' });
    expect(user).toEqual({ id: 'user-1', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' });
  });
});
