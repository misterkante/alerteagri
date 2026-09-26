import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AdviceController } from './advice.controller';
import { AdviceService } from './advice.service';

@Module({
  imports: [AlertsModule],
  controllers: [AdviceController],
  providers: [AdviceService],
  exports: [AdviceService],
})
export class AdviceModule {}
