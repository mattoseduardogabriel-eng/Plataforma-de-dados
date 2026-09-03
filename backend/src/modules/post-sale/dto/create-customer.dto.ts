import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { CustomerStatus, DocumentType } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Padaria Pão Quente Ltda' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Maringá' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Internet Empresarial 500Mb' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({ example: 349.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({
    description: 'Valores dos campos personalizados da organização (ver /post-sale/customer-fields), por chave.',
    example: { cliente_novo: true, segmento: 'Empresarial' },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string | boolean>;
}
