import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrmDashboardService } from './crm-dashboard.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crm')
@RequireFeature('crm')
@Controller('crm/dashboard')
export class CrmDashboardController {
  constructor(private readonly dashboardService: CrmDashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.overview(user.organizationId);
  }

  @Get('team')
  team(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.teamPerformance(user.organizationId);
  }
}
