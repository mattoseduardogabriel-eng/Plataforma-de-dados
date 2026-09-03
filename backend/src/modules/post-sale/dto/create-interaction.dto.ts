import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateInteractionDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ enum: InteractionType })
  @IsEnum(InteractionType)
  type: InteractionType;

  @ApiProperty({ example: 'Cliente relatou instabilidade no link' })
  @IsString()
  @MinLength(2)
  summary: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
