import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MinLength } from 'class-validator';

export class SaveLiroCrmCredentialsDto {
  @ApiProperty({ example: 'liro_a1b2c3d4e5f6g7h8_9f8e7d6c5b4a...' })
  @IsString()
  @MinLength(20)
  apiKey: string;

  @ApiProperty({ example: 'https://app.lirocrm.com.br/api/external/v1' })
  @IsUrl({ require_tld: false })
  baseUrl: string;
}
