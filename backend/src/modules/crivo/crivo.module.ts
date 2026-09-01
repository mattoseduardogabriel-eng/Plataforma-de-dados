import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { CrivoService } from './crivo.service';
import { CrivoController } from './crivo.controller';
import { DataIntelligenceModule } from '../data-intelligence/data-intelligence.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DataIntelligenceModule, AuditModule],
  controllers: [PoliciesController, CrivoController],
  providers: [PoliciesService, CrivoService],
})
export class CrivoModule {}
