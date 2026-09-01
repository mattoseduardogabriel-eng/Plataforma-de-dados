import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('cruzamento de dados')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateReportDto) {
    return this.reportsService.generate(user.organizationId, user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reportsService.findOne(user.organizationId, id);
  }

  @Get(':id/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportCsv(user.organizationId, id);
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${id}.csv"`);
    res.send(csv);
  }
}
