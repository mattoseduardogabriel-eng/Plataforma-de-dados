import { IsArray, IsString } from 'class-validator';

export class UpdateDashboardWidgetsDto {
  @IsArray()
  @IsString({ each: true })
  hiddenDashboardWidgets!: string[];
}
