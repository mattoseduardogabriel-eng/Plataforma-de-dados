import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class QueryPhoneDto {
  @ApiProperty({ example: '11987654321' })
  @IsString()
  @MinLength(10)
  phone: string;

  @ApiProperty({
    example: 'Confirmação de contato antes de proposta comercial',
    description: 'Finalidade da consulta — obrigatória e registrada em log de auditoria (LGPD).',
  })
  @IsString()
  @MinLength(5)
  purpose: string;
}
