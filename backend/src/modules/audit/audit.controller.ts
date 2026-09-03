import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auditoria')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.auditService.findForOrganization(
      user.organizationId,
      {
        entityType,
        userId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
      {
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined,
      },
    );
  }
}
