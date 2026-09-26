import { Module } from '@nestjs/common';
import { AdviceModule } from '../advice/advice.module';
import { ReportsModule } from '../reports/reports.module';
import { ContentModule } from '../content/content.module';
import { AlertsModule } from '../alerts/alerts.module';
import { UssdService } from './ussd.service';
import { UssdController } from './ussd.controller';

@Module({
  imports: [AdviceModule, ReportsModule, ContentModule, AlertsModule],
  controllers: [UssdController],
  providers: [UssdService],
})
export class UssdModule {}
