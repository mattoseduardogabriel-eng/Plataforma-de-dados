import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FeaturesService } from './features.service';
import { SetFeaturesDto } from './dto/set-sector-features.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Configuração de ferramentas do lado da própria empresa — dentro do teto
 * liberado pelo dono da plataforma (ver BackofficeController), o
 * ADMIN/GESTOR desliga por setor ou por usuário.
 */
@ApiTags('ferramentas')
@Controller('organizations/me/features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  /** O que o usuário logado enxerga de fato — usado pra esconder itens de menu no front. */
  @Get('effective')
  async effective(@CurrentUser() user: AuthenticatedUser) {
    const features = await this.featuresService.getEffectiveFeatures(user.organizationId, user.id);
    return { features: Array.from(features) };
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Get()
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.featuresService.getOrganizationFeatureConfig(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Patch('sectors/:sectorId')
  setSectorFeatures(
    @Param('sectorId') sectorId: string,
    @Body() dto: SetFeaturesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.featuresService.setSectorFeatures(user.organizationId, sectorId, dto.disabledFeatures, user.id);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Patch('users/:userId')
  setUserFeatures(
    @Param('userId') userId: string,
    @Body() dto: SetFeaturesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.featuresService.setUserFeatures(user.organizationId, userId, dto.disabledFeatures, user.id);
  }
}
