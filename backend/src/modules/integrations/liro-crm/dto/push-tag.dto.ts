import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PushLiroTagDto {
  @ApiProperty({ example: 'Crivo: Aprovado' })
  @IsString()
  @MinLength(1)
  tagName: string;
}
