import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrivoService } from './crivo.service';
import { EvaluateCrivoDto } from './dto/evaluate-crivo.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('crivo')
@Controller('crivo')
export class CrivoController {
  constructor(private readonly crivoService: CrivoService) {}

  @Post('evaluate')
  evaluate(@CurrentUser() user: AuthenticatedUser, @Body() dto: EvaluateCrivoDto) {
    return this.crivoService.evaluate(user.organizationId, user.id, dto);
  }

  @Get('decisions')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('targetDocument') targetDocument?: string) {
    return this.crivoService.findAll(user.organizationId, targetDocument);
  }
}
