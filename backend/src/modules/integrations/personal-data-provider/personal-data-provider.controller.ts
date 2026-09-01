import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PersonalDataProviderService } from './personal-data-provider.service';
import { SavePersonalDataProviderConfigDto } from './dto/save-config.dto';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('integrações')
@Controller('integrations/personal-data-provider')
export class PersonalDataProviderController {
  constructor(private readonly service: PersonalDataProviderService) {}

  @Get()
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Put()
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SavePersonalDataProviderConfigDto) {
    return this.service.saveConfig(user.organizationId, user.id, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete()
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.service.removeConfig(user.organizationId, user.id);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Post('test')
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.service.testConnection(user.organizationId);
  }
}
