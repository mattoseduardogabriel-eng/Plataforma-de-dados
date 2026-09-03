import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';

// Padrão conservador (2 anos) — AuditLog é a base de conformidade LGPD da
// plataforma (ver AuditService), então o período de retenção é uma
// decisão de negócio/jurídica, não só técnica. Ajustável via
// AUDIT_LOG_RETENTION_DAYS quando confirmado com quem cuida disso na
// empresa.
const RETENCAO_PADRAO_DIAS = 730;

@Injectable()
export class AuditRetentionScheduler {
  private readonly logger = new Logger(AuditRetentionScheduler.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  private retentionDays(): number {
    const configurado = Number(this.configService.get<string>('AUDIT_LOG_RETENTION_DAYS'));
    return configurado > 0 ? configurado : RETENCAO_PADRAO_DIAS;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expurgarAuditoriaAntiga(): Promise<void> {
    const dias = this.retentionDays();
    try {
      const apagados = await this.auditService.purgeOldEntries(dias);
      if (apagados > 0) {
        this.logger.log(`Expurgadas ${apagados} entrada(s) de auditoria com mais de ${dias} dias.`);
      }
    } catch (error) {
      this.logger.error(`Falha ao expurgar auditoria antiga: ${error instanceof Error ? error.message : error}`);
    }
  }
}
