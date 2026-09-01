import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('pós-venda')
@Controller('post-sale/contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto) {
    return this.contractsService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('customerId') customerId?: string) {
    return this.contractsService.findAll(user.organizationId, customerId);
  }
}
