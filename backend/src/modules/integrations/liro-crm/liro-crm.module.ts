import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LiroCrmConnector } from './liro-crm.connector';
import { LiroCrmService } from './liro-crm.service';
import { LiroCrmController } from './liro-crm.controller';
import { LiroCrmSyncScheduler } from './liro-crm-sync.scheduler';
import { AuditModule } from '../../audit/audit.module';
import { CryptoModule } from '../../../common/crypto/crypto.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [HttpModule, AuditModule, CryptoModule, RealtimeModule],
  controllers: [LiroCrmController],
  providers: [LiroCrmConnector, LiroCrmService, LiroCrmSyncScheduler],
  exports: [LiroCrmService],
})
export class LiroCrmModule {}
