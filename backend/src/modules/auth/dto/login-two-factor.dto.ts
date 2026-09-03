import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginTwoFactorDto {
  @ApiProperty({ description: 'pendingToken devolvido por POST /auth/login quando twoFactorRequired é true.' })
  @IsString()
  pendingToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Código deve ter 6 dígitos.' })
  token: string;
}
