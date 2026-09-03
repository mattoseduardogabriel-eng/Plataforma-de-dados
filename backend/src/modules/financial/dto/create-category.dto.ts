import { ApiProperty } from '@nestjs/swagger';
import { FinanceType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Mensalidades de Clientes' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: FinanceType })
  @IsEnum(FinanceType)
  type: FinanceType;
}
