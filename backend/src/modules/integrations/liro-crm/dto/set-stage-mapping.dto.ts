import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SetStageMappingDto {
  @ApiPropertyOptional({ description: 'Id da etapa no Liro CRM — omitir/null pra remover o mapeamento.' })
  @IsOptional()
  @IsString()
  liroKanbanStageId?: string | null;

  @ApiPropertyOptional({ description: 'Nome da etapa no Liro CRM, só pra exibição — não é usado pra mover nada.' })
  @IsOptional()
  @IsString()
  liroKanbanStageName?: string | null;
}
