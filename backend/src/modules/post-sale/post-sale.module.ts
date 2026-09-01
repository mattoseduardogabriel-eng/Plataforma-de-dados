import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { ChurnService } from './churn.service';
import { ChurnController } from './churn.controller';

@Module({
  controllers: [
    CustomersController,
    ContractsController,
    InteractionsController,
    ChurnController,
  ],
  providers: [CustomersService, ContractsService, InteractionsService, ChurnService],
  exports: [CustomersService],
})
export class PostSaleModule {}
