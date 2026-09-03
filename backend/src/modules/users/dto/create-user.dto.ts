import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Carlos Lima' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'carlos@franquiademo.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.VENDEDOR })
  @IsEnum(Role)
  role: Role;
}
