import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Langues229Provider, VOICE_PROVIDER } from './voice.provider';

@Module({
  imports: [AlertsModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    { provide: VOICE_PROVIDER, useFactory: () => new Langues229Provider() },
  ],
  exports: [ContentService],
})
export class ContentModule {}
