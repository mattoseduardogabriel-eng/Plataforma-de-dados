import { Module } from '@nestjs/common';
import { BackofficeService } from './backoffice.service';
import { BackofficeController } from './backoffice.controller';
import { AuditModule } from '../audit/audit.module';
import { FeaturesModule } from '../features/features.module';

@Module({
  imports: [AuditModule, FeaturesModule],
  controllers: [BackofficeController],
  providers: [BackofficeService],
})
export class BackofficeModule {}
