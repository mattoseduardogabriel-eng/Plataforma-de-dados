import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crm')
@RequireFeature('crm')
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user.organizationId, user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dealId') dealId?: string,
    @Query('leadId') leadId?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.activitiesService.findAll(user.organizationId, { dealId, leadId, assignedToId });
  }

  @Patch(':id/done')
  markDone(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.activitiesService.markDone(user.organizationId, id);
  }

  // Rota fixa ('completed') precisa vir ANTES de ':id' — senão o Nest
  // tentaria casar "completed" como um :id de verdade.
  @Delete('completed')
  removeCompleted(@CurrentUser() user: AuthenticatedUser, @Query('assignedToId') assignedToId?: string) {
    return this.activitiesService.removeCompleted(user.organizationId, { assignedToId });
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.activitiesService.remove(user.organizationId, id);
  }
}
