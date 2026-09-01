import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { DataIntelligenceModule } from '../data-intelligence/data-intelligence.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DataIntelligenceModule, AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
