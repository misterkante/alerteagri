import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { TraceService } from './trace.service';
import { TraceController } from './trace.controller';

@Module({
  imports: [AlertsModule],
  controllers: [TraceController],
  providers: [TraceService],
})
export class TraceModule {}
