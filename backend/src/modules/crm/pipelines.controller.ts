import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PipelinesService } from './pipelines.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('crm')
@Controller('crm/pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.pipelinesService.findAll(user.organizationId);
  }
}
