import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { SaveLeadToWalletDto } from './dto/save-lead-to-wallet.dto';
import { SaveLeadsToWalletBulkDto } from './dto/save-leads-to-wallet-bulk.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crm')
@RequireFeature('crm')
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.organizationId, user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAll(user.organizationId, { status, assignedToId, search });
  }

  // Rota fixa: precisa vir antes de ':id', senão o Nest casa "by-phone"
  // como se fosse um id de lead. Usada pelo deep-link "Abrir no Aster"
  // clicado de dentro de uma conversa do Liro CRM.
  @Get('by-phone')
  findByPhone(@CurrentUser() user: AuthenticatedUser, @Query('phone') phone: string) {
    return this.leadsService.findByPhone(user.organizationId, phone);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.remove(user.organizationId, id);
  }

  @Post(':id/save-to-wallet')
  saveToWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveLeadToWalletDto,
  ) {
    return this.leadsService.saveToWallet(user.organizationId, id, dto.name);
  }

  @Post('save-to-wallet/bulk')
  saveManyToWallet(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveLeadsToWalletBulkDto) {
    return this.leadsService.saveManyToWallet(user.organizationId, dto.items);
  }
}
