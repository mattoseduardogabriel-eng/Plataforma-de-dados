import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MergeLeadDto {
  @ApiProperty({ description: 'Telefone do outro lead a ser mesclado (absorvido) neste' })
  @IsString()
  @MinLength(4)
  phone: string;
}
