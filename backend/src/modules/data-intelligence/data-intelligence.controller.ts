import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { DataQueryType } from '@prisma/client';
import { DataIntelligenceService } from './data-intelligence.service';
import { QueryDocumentDto } from './dto/query-document.dto';
import { QueryPhoneDto } from './dto/query-phone.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';

@ApiTags('inteligência de dados')
@Controller('data-intelligence')
export class DataIntelligenceController {
  constructor(private readonly dataIntelligenceService: DataIntelligenceService) {}

  @RequireFeature('consulta_cnpj')
  @Post('cnpj/query')
  queryCnpj(@CurrentUser() user: AuthenticatedUser, @Body() dto: QueryDocumentDto, @Req() req: Request) {
    return this.dataIntelligenceService.queryCnpj({
      organizationId: user.organizationId,
      userId: user.id,
      target: dto.document,
      purpose: dto.purpose,
      ipAddress: req.ip,
    });
  }

  @RequireFeature('consulta_cpf')
  @Post('cpf/query')
  queryCpf(@CurrentUser() user: AuthenticatedUser, @Body() dto: QueryDocumentDto, @Req() req: Request) {
    return this.dataIntelligenceService.queryCpf({
      organizationId: user.organizationId,
      userId: user.id,
      target: dto.document,
      purpose: dto.purpose,
      ipAddress: req.ip,
    });
  }

  @RequireFeature('consulta_telefone')
  @Post('phone/query')
  queryPhone(@CurrentUser() user: AuthenticatedUser, @Body() dto: QueryPhoneDto, @Req() req: Request) {
    return this.dataIntelligenceService.queryPhone({
      organizationId: user.organizationId,
      userId: user.id,
      target: dto.phone,
      purpose: dto.purpose,
      ipAddress: req.ip,
    });
  }

  @RequireFeature('consulta_credito')
  @Post('credit-score/query')
  queryCreditScore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueryDocumentDto,
    @Req() req: Request,
  ) {
    return this.dataIntelligenceService.queryCreditScore({
      organizationId: user.organizationId,
      userId: user.id,
      target: dto.document,
      purpose: dto.purpose,
      ipAddress: req.ip,
    });
  }

  @RequireFeature('consulta_parentes')
  @Post('relatives/query')
  queryRelatives(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueryDocumentDto,
    @Req() req: Request,
  ) {
    return this.dataIntelligenceService.queryRelatives({
      organizationId: user.organizationId,
      userId: user.id,
      target: dto.document,
      purpose: dto.purpose,
      ipAddress: req.ip,
    });
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: DataQueryType,
    @Query('targetDocument') targetDocument?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.dataIntelligenceService.history(
      user.organizationId,
      { type, targetDocument, dataInicio, dataFim },
      { skip: skip ? Number(skip) : undefined, take: take ? Number(take) : undefined },
    );
  }
}
