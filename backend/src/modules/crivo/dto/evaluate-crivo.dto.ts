import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class EvaluateCrivoDto {
  @ApiProperty({ example: '19131243000197' })
  @IsString()
  @MinLength(11)
  document: string;

  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiProperty({
    example: 'Aprovação de crédito para contratação de plano empresarial',
    description: 'Finalidade da avaliação — obrigatória e registrada em auditoria (LGPD).',
  })
  @IsString()
  @MinLength(5)
  purpose: string;

  @ApiPropertyOptional({ description: 'ID da política a usar; se omitido, usa a política padrão ativa.' })
  @IsOptional()
  @IsUUID()
  policyId?: string;
}
