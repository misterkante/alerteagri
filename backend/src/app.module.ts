import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { accountThrottler } from './auth/login-throttle';
import { requestTracker } from './common/request-tracker';
import { AuditModule } from './common/audit.module';
import { ReferentialModule } from './referential/referential.module';
import { WeatherModule } from './weather/weather.module';
import { AlertsModule } from './alerts/alerts.module';
import { AdviceModule } from './advice/advice.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { ContentModule } from './content/content.module';
import { UssdModule } from './ussd/ussd.module';
import { MarketModule } from './market/market.module';
import { TaxModule } from './tax/tax.module';
import { TraceModule } from './trace/trace.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        // Read on each request, like the other limits, so tests and hosting can set it late.
        limit: () => Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
        getTracker: requestTracker,
      },
      accountThrottler,
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    ReferentialModule,
    WeatherModule,
    AlertsModule,
    AdviceModule,
    ReportsModule,
    UsersModule,
    ContentModule,
    UssdModule,
    MarketModule,
    TaxModule,
    TraceModule,
    DashboardModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
