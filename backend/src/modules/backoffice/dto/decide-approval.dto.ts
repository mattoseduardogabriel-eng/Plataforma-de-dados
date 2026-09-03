import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DecideApprovalDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  // Só usado em APPROVE — quantos dias de teste a empresa ganha a partir de agora.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  // Só usado em REJECT — motivo mostrado pro usuário ao tentar logar.
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
