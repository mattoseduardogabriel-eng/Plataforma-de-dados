import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditRetentionScheduler } from './audit-retention.scheduler';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRetentionScheduler],
  exports: [AuditService],
})
export class AuditModule {}
