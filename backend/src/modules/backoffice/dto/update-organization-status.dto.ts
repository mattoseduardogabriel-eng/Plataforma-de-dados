import { IsBoolean } from 'class-validator';

export class UpdateOrganizationStatusDto {
  @IsBoolean()
  active!: boolean;
}
