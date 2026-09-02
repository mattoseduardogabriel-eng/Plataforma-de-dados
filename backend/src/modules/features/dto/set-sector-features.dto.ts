import { IsArray, IsString } from 'class-validator';

export class SetFeaturesDto {
  @IsArray()
  @IsString({ each: true })
  disabledFeatures!: string[];
}
