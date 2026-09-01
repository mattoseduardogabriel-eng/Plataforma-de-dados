import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ example: '19131243000197' })
  @IsString()
  @MinLength(11)
  targetDocument: string;

  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiProperty({
    example: 'Due diligence antes de assinatura de contrato empresarial',
    description: 'Finalidade do cruzamento — obrigatória e registrada em auditoria (LGPD).',
  })
  @IsString()
  @MinLength(5)
  purpose: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}
