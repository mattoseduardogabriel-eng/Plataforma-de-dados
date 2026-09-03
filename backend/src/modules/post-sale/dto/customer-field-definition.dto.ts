import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomFieldType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateCustomerFieldDefinitionDto {
  @ApiProperty({ example: 'Cliente novo' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @ApiPropertyOptional({ example: ['Residencial', 'Empresarial', 'Governo'], description: 'Obrigatório quando type = LISTA' })
  @ValidateIf((o) => o.type === 'LISTA')
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  options?: string[];
}
