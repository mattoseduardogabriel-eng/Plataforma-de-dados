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
