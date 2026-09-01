import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class QueryDocumentDto {
  @ApiProperty({ example: '19131243000197', description: 'CPF ou CNPJ, com ou sem máscara' })
  @IsString()
  @MinLength(11)
  document: string;

  @ApiProperty({
    example: 'Análise de crédito para contratação de plano empresarial',
    description: 'Finalidade da consulta — obrigatória e registrada em log de auditoria (LGPD).',
  })
  @IsString()
  @MinLength(5)
  purpose: string;
}
