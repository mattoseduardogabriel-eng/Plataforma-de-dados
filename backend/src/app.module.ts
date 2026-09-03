import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AuditModule } from './modules/audit/audit.module';
import { CrmModule } from './modules/crm/crm.module';
import { FinancialModule } from './modules/financial/financial.module';
import { PostSaleModule } from './modules/post-sale/post-sale.module';
import { DataIntelligenceModule } from './modules/data-intelligence/data-intelligence.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CrivoModule } from './modules/crivo/crivo.module';
import { LiroCrmModule } from './modules/integrations/liro-crm/liro-crm.module';
import { PersonalDataProviderModule } from './modules/integrations/personal-data-provider/personal-data-provider.module';
import { BackofficeModule } from './modules/backoffice/backoffice.module';
import { FeaturesModule } from './modules/features/features.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    RealtimeModule,
    CrmModule,
    FinancialModule,
    PostSaleModule,
    DataIntelligenceModule,
    ReportsModule,
    CrivoModule,
    LiroCrmModule,
    PersonalDataProviderModule,
    BackofficeModule,
    FeaturesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
