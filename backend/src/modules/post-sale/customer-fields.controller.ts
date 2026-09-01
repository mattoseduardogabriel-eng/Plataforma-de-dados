import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CustomerFieldsService } from './customer-fields.service';
import { CreateCustomerFieldDefinitionDto } from './dto/customer-field-definition.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('pós-venda')
@Controller('post-sale/customer-fields')
export class CustomerFieldsController {
  constructor(private readonly service: CustomerFieldsService) {}

  // Leitura liberada pra qualquer papel — todo mundo usa os filtros,
  // só a criação/remoção é restrita (ver @Roles abaixo).
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.organizationId);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerFieldDefinitionDto) {
    return this.service.create(user.organizationId, user.id, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user.organizationId, user.id, id);
  }
}
