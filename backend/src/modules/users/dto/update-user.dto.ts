import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Setor do usuário — null pra remover de qualquer setor.' })
  @IsOptional()
  @IsString()
  sectorId?: string | null;

  @ApiPropertyOptional({
    description:
      'ID do operador correspondente no Liro CRM — vínculo best-effort, não confirmado contra a API real do Liro.',
  })
  @IsOptional()
  @IsString()
  liroOperatorId?: string | null;
}
