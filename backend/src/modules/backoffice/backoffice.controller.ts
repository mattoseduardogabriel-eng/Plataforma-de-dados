import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BackofficeService } from './backoffice.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Backoffice do dono da plataforma Aster — gerencia as empresas clientes
 * (franquias) cadastradas. Restrito a SUPER_ADMIN; nenhum usuário de
 * empresa cliente acessa estas rotas.
 */
@ApiTags('backoffice')
@Roles(Role.SUPER_ADMIN)
@Controller('backoffice/organizations')
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get()
  list() {
    return this.backofficeService.listOrganizations();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.backofficeService.getOrganization(id);
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.backofficeService.createOrganization(dto, user.id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backofficeService.setOrganizationStatus(id, dto, user.id);
  }
}
