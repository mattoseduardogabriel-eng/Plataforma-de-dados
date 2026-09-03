import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiPropertyOptional({ description: 'Meta de faturamento do mês, em centavos — usada no widget "Meta x Produção" do dashboard.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyGoalCents?: number;
}
