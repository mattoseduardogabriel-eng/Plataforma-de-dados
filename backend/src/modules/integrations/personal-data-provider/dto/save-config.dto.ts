import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MinLength } from 'class-validator';

export const PERSONAL_DATA_PROVIDERS = [
  'SERASA',
  'BOA_VISTA',
  'BIG_DATA_CORP',
  'ASSERTIVA',
  'QUOD',
  'GENERICO',
] as const;

/**
 * Um caminho de consulta, quando informado, precisa conter o placeholder
 * {documento} — é nele que o CPF/documento consultado entra na URL.
 */
const PATH_PATTERN = /\{documento\}/;

export class SavePersonalDataProviderConfigDto {
  @ApiProperty({ enum: PERSONAL_DATA_PROVIDERS, example: 'SERASA' })
  @IsIn(PERSONAL_DATA_PROVIDERS)
  provider: (typeof PERSONAL_DATA_PROVIDERS)[number];

  @ApiProperty({ example: 'https://api.provedor.com.br/v1' })
  @IsUrl({ require_tld: false })
  baseUrl: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @MinLength(8)
  apiKey: string;

  @ApiPropertyOptional({ default: 'Authorization' })
  @IsOptional()
  @IsString()
  authHeaderName?: string;

  @ApiPropertyOptional({ default: 'Bearer', description: 'Prefixo antes da chave no header. Deixe em branco ("") se o provedor não usar prefixo.' })
  @IsOptional()
  @IsString()
  authScheme?: string;

  @ApiPropertyOptional({ example: '/pessoas/{documento}' })
  @IsOptional()
  @IsString()
  @Matches(PATH_PATTERN, { message: 'cpfPath deve conter o placeholder {documento}' })
  cpfPath?: string;

  @ApiPropertyOptional({ example: '/telefones/{documento}' })
  @IsOptional()
  @IsString()
  @Matches(PATH_PATTERN, { message: 'phonePath deve conter o placeholder {documento}' })
  phonePath?: string;

  @ApiPropertyOptional({ example: '/pessoas/{documento}/score' })
  @IsOptional()
  @IsString()
  @Matches(PATH_PATTERN, { message: 'creditScorePath deve conter o placeholder {documento}' })
  creditScorePath?: string;

  @ApiPropertyOptional({ example: '/pessoas/{documento}/vinculos' })
  @IsOptional()
  @IsString()
  @Matches(PATH_PATTERN, { message: 'relativesPath deve conter o placeholder {documento}' })
  relativesPath?: string;
}
