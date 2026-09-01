import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LiroCrmConnector } from './liro-crm.connector';
import { LiroCrmService } from './liro-crm.service';
import { LiroCrmController } from './liro-crm.controller';
import { AuditModule } from '../../audit/audit.module';
import { CryptoModule } from '../../../common/crypto/crypto.module';

@Module({
  imports: [HttpModule, AuditModule, CryptoModule],
  controllers: [LiroCrmController],
  providers: [LiroCrmConnector, LiroCrmService],
  exports: [LiroCrmService],
})
export class LiroCrmModule {}
