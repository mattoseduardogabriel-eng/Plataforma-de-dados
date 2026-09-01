import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DataIntelligenceService } from './data-intelligence.service';
import { DataIntelligenceController } from './data-intelligence.controller';
import { CnpjConnector } from './connectors/cnpj.connector';
import { CpfConnector } from './connectors/cpf.connector';
import { PhoneConnector } from './connectors/phone.connector';
import { CreditScoreConnector } from './connectors/credit-score.connector';
import { RelativesConnector } from './connectors/relatives.connector';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [HttpModule, AuditModule],
  controllers: [DataIntelligenceController],
  providers: [
    DataIntelligenceService,
    CnpjConnector,
    CpfConnector,
    PhoneConnector,
    CreditScoreConnector,
    RelativesConnector,
  ],
  exports: [
    DataIntelligenceService,
    CnpjConnector,
    CpfConnector,
    PhoneConnector,
    CreditScoreConnector,
    RelativesConnector,
  ],
})
export class DataIntelligenceModule {}
