import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Política Padrão — Planos Empresariais' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: 700, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  minScoreApproved?: number;

  @ApiPropertyOptional({ default: 400, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  minScoreManualReview?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPendenciasAllowed?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  blockIfCnpjInativa?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  flagIfChurnRiskAlto?: boolean;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimitPerScorePoint?: number;

  @ApiPropertyOptional({ default: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCreditLimit?: number;
}
