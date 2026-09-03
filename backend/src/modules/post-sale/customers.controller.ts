import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportCustomersDto } from './dto/import-customers.dto';
import { BulkDeleteCustomersDto } from './dto/bulk-delete-customers.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('pós-venda')
@RequireFeature('pos_venda')
@Controller('post-sale/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.organizationId, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR, Role.ATENDIMENTO)
  @Post('import')
  importMany(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportCustomersDto) {
    return this.customersService.importMany(user.organizationId, user.id, dto.customers);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('name') name?: string,
    @Query('document') document?: string,
    @Query('city') city?: string,
    @Query('planName') planName?: string,
    @Query('status') status?: string,
    @Query('churnRiskLevel') churnRiskLevel?: string,
    @Query('customFields') customFields?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll(user.organizationId, {
      name,
      document,
      city,
      planName,
      status: status ? status.split(',') : undefined,
      churnRiskLevel: churnRiskLevel ? churnRiskLevel.split(',') : undefined,
      customFields,
      sortBy: sortBy as any,
      sortDir: sortDir as any,
      search,
    });
  }

  // Rotas fixas (/all, exclusão em massa) precisam vir antes de ':id' —
  // senão o Nest casa "all" como se fosse um id de cliente.
  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete('all')
  deleteAll(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.deleteAll(user.organizationId, user.id);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete()
  deleteMany(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDeleteCustomersDto) {
    return this.customersService.deleteMany(user.organizationId, user.id, dto.ids);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.organizationId, id, dto);
  }
}
