import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LiroCrmService } from './liro-crm.service';
import { SaveLiroCrmCredentialsDto } from './dto/save-credentials.dto';
import { PushLiroTagDto } from './dto/push-tag.dto';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequireFeature } from '../../../common/decorators/require-feature.decorator';

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
}
