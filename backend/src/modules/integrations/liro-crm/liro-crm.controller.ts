import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LiroCrmService } from './liro-crm.service';
import { SaveLiroCrmCredentialsDto } from './dto/save-credentials.dto';
import { PushLiroTagDto } from './dto/push-tag.dto';
import { SetStageMappingDto } from './dto/set-stage-mapping.dto';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequireFeature } from '../../../common/decorators/require-feature.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('integrações')
@RequireFeature('integracao_liro_crm')
@Controller('integrations/liro-crm')
export class LiroCrmController {
  constructor(private readonly liroCrmService: LiroCrmService) {}

  @Get()
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.liroCrmService.status(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Put()
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveLiroCrmCredentialsDto) {
    return this.liroCrmService.saveCredentials(user.organizationId, user.id, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete()
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.liroCrmService.removeCredentials(user.organizationId, user.id);
  }

  @Post('test')
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.liroCrmService.testConnection(user.organizationId);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser) {
    return this.liroCrmService.syncContacts(user.organizationId, user.id);
  }

  @Post('leads/:leadId/tags')
  pushTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
    @Body() dto: PushLiroTagDto,
  ) {
    return this.liroCrmService.pushTagForLead(user.organizationId, user.id, leadId, dto.tagName);
  }

  // --- Sincronização de funil ---

  @Get('kanban-stages')
  listKanbanStages(@CurrentUser() user: AuthenticatedUser) {
    return this.liroCrmService.listKanbanStages(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Put('pipeline-stages/:pipelineStageId/mapping')
  setStageMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pipelineStageId') pipelineStageId: string,
    @Body() dto: SetStageMappingDto,
  ) {
    return this.liroCrmService.setStageMapping(user.organizationId, pipelineStageId, dto);
  }

  // Chamado pelo Liro CRM em si (server-to-server, sem login) quando uma
  // conversa muda de etapa por lá — ver LiroCrmService.saveCredentials()
  // (registro automático) e handleInboundWebhook() (o que faz aqui). O
  // :token identifica a organização sem depender de sessão nenhuma —
  // nunca o id da organização em si, pra não dar pra forjar evento só
  // adivinhando o id.
  @Public()
  @HttpCode(200)
  @Post('webhook/:token')
  async receiveWebhook(@Param('token') token: string, @Body() payload: Record<string, unknown>) {
    await this.liroCrmService.handleInboundWebhook(token, payload);
    return { ok: true };
  }
}
