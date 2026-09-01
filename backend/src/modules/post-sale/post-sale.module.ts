import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { ChurnService } from './churn.service';
import { ChurnController } from './churn.controller';
import { CustomerFieldsService } from './customer-fields.service';
import { CustomerFieldsController } from './customer-fields.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [
    CustomersController,
    ContractsController,
    InteractionsController,
    ChurnController,
    CustomerFieldsController,
  ],
  providers: [CustomersService, ContractsService, InteractionsService, ChurnService, CustomerFieldsService],
  exports: [CustomersService],
})
export class PostSaleModule {}
