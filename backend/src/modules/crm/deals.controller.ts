import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';
import { CloseDealDto } from './dto/close-deal.dto';
import { BulkRemoveDealsDto } from './dto/bulk-remove-deals.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crm')
@RequireFeature('crm')
@Controller('crm/deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDealDto) {
    return this.dealsService.create(user.organizationId, user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('pipelineId') pipelineId?: string,
    @Query('stageId') stageId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: string,
  ) {
    return this.dealsService.findAll(user.organizationId, { pipelineId, stageId, ownerId, status });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dealsService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(user.organizationId, id, dto);
  }

  @Patch(':id/move')
  move(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: MoveDealDto) {
    return this.dealsService.move(user.organizationId, id, dto.stageId, user.id);
  }

  @Patch(':id/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloseDealDto) {
    return this.dealsService.close(user.organizationId, id, dto, user.id);
  }

  // Remove do Funil de Vendas (o Lead de origem continua existindo) —
  // usado pela seleção em retângulo no quadro. Sem rota de id único de
  // propósito: manda sempre uma lista, mesmo que com 1 item.
  @Delete()
  removeMany(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkRemoveDealsDto) {
    return this.dealsService.removeMany(user.organizationId, user.id, dto.ids);
  }
}
