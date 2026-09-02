import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreatePipelineStageDto {
  @ApiProperty({ example: 'Follow-up' })
  @IsString()
  @MinLength(2)
  name: string;
}
