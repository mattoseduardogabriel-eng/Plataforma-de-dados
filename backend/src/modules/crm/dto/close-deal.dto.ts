import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CloseDealDto {
  @ApiProperty({ enum: ['GANHO', 'PERDIDO'] })
  @IsIn(['GANHO', 'PERDIDO'])
  outcome: 'GANHO' | 'PERDIDO';

  @ApiPropertyOptional({ example: 'Preço acima do orçamento do cliente' })
  @IsOptional()
  @IsString()
  lostReason?: string;
}
