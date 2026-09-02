import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

class SaveLeadToWalletBulkItemDto {
  @ApiProperty()
  @IsString()
  leadId: string;

  @ApiProperty({ required: false, description: 'Nome pra salvar — se não vier, usa o nome do lead.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class SaveLeadsToWalletBulkDto {
  @ApiProperty({ type: [SaveLeadToWalletBulkItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SaveLeadToWalletBulkItemDto)
  items: SaveLeadToWalletBulkItemDto[];
}
