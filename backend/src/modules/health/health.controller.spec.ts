import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: any;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    controller = new HealthController(prisma);
  });

  it('devolve status ok quando o banco responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const resultado = await controller.check();

    expect(resultado.status).toBe('ok');
    expect(resultado.database).toBe('ok');
    expect(typeof resultado.databaseLatencyMs).toBe('number');
  });

  it('lança 503 quando o banco não responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('conexão recusada'));

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
