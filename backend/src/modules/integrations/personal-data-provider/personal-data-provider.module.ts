import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PersonalDataProviderService } from './personal-data-provider.service';
import { PersonalDataProviderController } from './personal-data-provider.controller';
import { PersonalDataProviderConnector } from './personal-data-provider.connector';
import { AuditModule } from '../../audit/audit.module';
import { CryptoModule } from '../../../common/crypto/crypto.module';

@Module({
  imports: [HttpModule, AuditModule, CryptoModule],
  controllers: [PersonalDataProviderController],
  providers: [PersonalDataProviderService, PersonalDataProviderConnector],
  exports: [PersonalDataProviderService],
})
export class PersonalDataProviderModule {}
