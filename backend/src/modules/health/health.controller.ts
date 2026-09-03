import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

// Endpoint pra monitoramento externo (UptimeRobot, health check da
// hospedagem, etc) confirmar que a API está de pé E consegue falar com o
// banco — não adianta o processo Node estar rodando se o Postgres caiu.
// Público de propósito (sem login) — é assim que ferramenta de
// monitoramento de fora bate nisso; não expõe nada sensível, só
// "up"/"down" e o tempo de resposta do banco.
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    const inicio = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'down',
        database: 'down',
        error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar o banco.',
      });
    }

    return {
      status: 'ok',
      database: 'ok',
      databaseLatencyMs: Date.now() - inicio,
      timestamp: new Date().toISOString(),
    };
  }
}
