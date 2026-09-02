import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('crivo')
@RequireFeature('crivo')
@Controller('crivo/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Roles(Role.ADMIN, Role.GESTOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePolicyDto) {
    return this.policiesService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.policiesService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.policiesService.findOne(user.organizationId, id);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policiesService.update(user.organizationId, id, dto);
  }

  @Roles(Role.ADMIN, Role.GESTOR)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.policiesService.remove(user.organizationId, id);
  }
}
