import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialDashboardService } from './financial-dashboard.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('financeiro')
@Controller('financial/dashboard')
export class FinancialDashboardController {
  constructor(private readonly dashboardService: FinancialDashboardService) {}

  @Get('cash-flow')
  cashFlow(@CurrentUser() user: AuthenticatedUser, @Query('months') months?: string) {
    return this.dashboardService.cashFlow(user.organizationId, months ? Number(months) : undefined);
  }
}
