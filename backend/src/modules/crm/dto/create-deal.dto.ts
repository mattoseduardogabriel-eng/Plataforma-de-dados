import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateDealDto {
  @ApiProperty({ example: 'Plano Empresarial 500Mb — Padaria Pão Quente' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  leadId?: string;

  // Alternativa a leadId: em vez de escolher um lead já existente, informa
  // os dados de contato direto na hora de criar a negociação — o backend
  // acha/cria o lead correspondente (por telefone) e vincula sozinho. Só
  // faz sentido quando leadId não vem preenchido.
  @ApiPropertyOptional({ description: 'Nome do contato — usado só se leadId não for informado.' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Telefone do contato — usado só se leadId não for informado.' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'CPF ou CNPJ do contato — usado só se leadId não for informado.' })
  @IsOptional()
  @IsString()
  contactDocument?: string;

  @ApiProperty()
  @IsUUID()
  pipelineId: string;

  @ApiProperty()
  @IsUUID()
  stageId: string;

  @ApiPropertyOptional({ example: 'Internet Empresarial 500Mb + Link Dedicado' })
  @IsOptional()
  @IsString()
  productPlan?: string;

  @ApiProperty({ example: 349.9 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}
