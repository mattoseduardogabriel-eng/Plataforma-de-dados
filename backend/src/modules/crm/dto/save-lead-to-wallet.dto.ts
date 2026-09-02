import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SaveLeadToWalletDto {
  @ApiPropertyOptional({
    description: 'Nome pra salvar no cliente — se não vier, usa o nome do lead como está.',
    example: 'Ana Paula Ferreira',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
