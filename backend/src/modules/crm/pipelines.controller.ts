import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PipelinesService } from './pipelines.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crm')
@RequireFeature('crm')
@Controller('crm/pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.pipelinesService.findAll(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Post(':pipelineId/stages')
  createStage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreatePipelineStageDto,
  ) {
    return this.pipelinesService.createStage(user.organizationId, pipelineId, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete('stages/:stageId')
  deleteStage(@CurrentUser() user: AuthenticatedUser, @Param('stageId') stageId: string) {
    return this.pipelinesService.deleteStage(user.organizationId, stageId);
  }
}
