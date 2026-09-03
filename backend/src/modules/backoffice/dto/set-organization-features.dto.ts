import { IsArray, IsString } from 'class-validator';

export class SetOrganizationFeaturesDto {
  @IsArray()
  @IsString({ each: true })
  enabledFeatures!: string[];
}
