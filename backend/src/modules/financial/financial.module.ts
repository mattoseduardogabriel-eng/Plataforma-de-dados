import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { FinancialDashboardService } from './financial-dashboard.service';
import { FinancialDashboardController } from './financial-dashboard.controller';

@Module({
  controllers: [CategoriesController, TransactionsController, FinancialDashboardController],
  providers: [CategoriesService, TransactionsService, FinancialDashboardService],
})
export class FinancialModule {}
