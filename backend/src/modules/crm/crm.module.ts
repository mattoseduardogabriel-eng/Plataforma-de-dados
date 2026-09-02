import { Module } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import { PipelinesController } from './pipelines.controller';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { CrmDashboardService } from './crm-dashboard.service';
import { CrmDashboardController } from './crm-dashboard.controller';
import { SectorsService } from './sectors.service';
import { SectorsController } from './sectors.controller';
import { LiroCrmModule } from '../integrations/liro-crm/liro-crm.module';

@Module({
  imports: [LiroCrmModule],
  controllers: [
    PipelinesController,
    LeadsController,
    DealsController,
    ActivitiesController,
    CrmDashboardController,
    SectorsController,
  ],
  providers: [
    PipelinesService,
    LeadsService,
    DealsService,
    ActivitiesService,
    CrmDashboardService,
    SectorsService,
  ],
})
export class CrmModule {}
