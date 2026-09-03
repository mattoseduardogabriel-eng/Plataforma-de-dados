import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyTwoFactorDto {
  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Código deve ter 6 dígitos.' })
  token?: string;

  // Só usado em POST /2fa/disable — alternativa ao código, pra quem
  // perdeu o celular com o app autenticador mas ainda sabe a senha.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;
}
