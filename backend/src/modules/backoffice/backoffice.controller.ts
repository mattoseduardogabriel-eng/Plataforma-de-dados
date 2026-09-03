import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BackofficeService } from './backoffice.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SetOrganizationFeaturesDto } from './dto/set-organization-features.dto';
import { FeaturesService } from '../features/features.service';
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
  constructor(
    private readonly backofficeService: BackofficeService,
    private readonly featuresService: FeaturesService,
  ) {}

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

  @Patch(':id/approval')
  decideApproval(
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backofficeService.decideApproval(id, dto, user.id);
  }

  @Patch(':id/subscription')
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backofficeService.updateSubscription(id, dto, user.id);
  }

  /** Teto de ferramentas que essa empresa tem direito de usar. */
  @Patch(':id/features')
  setFeatures(
    @Param('id') id: string,
    @Body() dto: SetOrganizationFeaturesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.featuresService.setOrganizationFeatures(id, dto.enabledFeatures, user.id);
  }
}
