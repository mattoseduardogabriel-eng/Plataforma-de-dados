import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsOptional()
  @IsString()
  organizationCnpj?: string;

  @IsString()
  @MinLength(2)
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  // Empresa criada direto pelo backoffice já nasce aprovada — só o período
  // de teste é configurável (padrão 14 dias, 0 = sem teste/já paga).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;
}
