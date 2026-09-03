import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSectorDto {
  @ApiProperty({ example: 'Comercial Maringá' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;
}
