import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';

@Module({
  imports: [AlertsModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
