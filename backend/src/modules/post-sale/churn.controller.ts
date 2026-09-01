import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChurnService } from './churn.service';
import { CreateChurnSignalDto } from './dto/create-churn-signal.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('pós-venda')
@Controller('post-sale')
export class ChurnController {
  constructor(private readonly churnService: ChurnService) {}

  @Post('churn-signals')
  recordSignal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChurnSignalDto) {
    return this.churnService.recordSignal(user.organizationId, dto);
  }

  @Get('dashboard/portfolio')
  portfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.churnService.portfolioOverview(user.organizationId);
  }
}
