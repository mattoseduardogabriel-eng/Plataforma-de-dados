import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MoveDealDto {
  @ApiProperty()
  @IsUUID()
  stageId: string;
}
