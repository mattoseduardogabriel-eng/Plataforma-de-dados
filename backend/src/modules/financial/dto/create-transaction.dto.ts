import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceType, TransactionStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ enum: FinanceType })
  @IsEnum(FinanceType)
  type: FinanceType;

  @ApiProperty({ example: 'Mensalidade — Padaria Pão Quente' })
  @IsString()
  @MinLength(2)
  description: string;

  @ApiProperty({ example: 349.9 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
