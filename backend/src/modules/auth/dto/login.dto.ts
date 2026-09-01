import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@franquiademo.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Demo@123456' })
  @IsString()
  @MinLength(6)
  password: string;
}
