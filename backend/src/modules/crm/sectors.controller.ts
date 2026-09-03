import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SectorsService } from './sectors.service';
import { CreateSectorDto } from './dto/sector.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('crm')
@Controller('crm/sectors')
export class SectorsController {
  constructor(private readonly service: SectorsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSectorDto) {
    return this.service.create(user.organizationId, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user.organizationId, id);
  }
}
