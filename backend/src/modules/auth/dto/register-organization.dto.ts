import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @ApiProperty({ example: 'Franquia Telecom Centro-Oeste' })
  @IsString()
  @MinLength(2)
  organizationName: string;

  @ApiProperty({ example: '12.345.678/0001-90', required: false })
  @IsOptional()
  @IsString()
  organizationCnpj?: string;

  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ana@franquiademo.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
