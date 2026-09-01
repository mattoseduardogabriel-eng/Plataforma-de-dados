import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateContractDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ example: 'Internet Empresarial 500Mb' })
  @IsString()
  @MinLength(2)
  planName: string;

  @ApiProperty({ example: 349.9 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
