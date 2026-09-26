import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { InternalOutboxProvider, SMS_PROVIDER } from './sms.provider';

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    { provide: SMS_PROVIDER, useClass: InternalOutboxProvider },
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
