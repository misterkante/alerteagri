import { Module } from '@nestjs/common';
import { ReferentialController } from './referential.controller';
import { ReferentialService } from './referential.service';

@Module({
  controllers: [ReferentialController],
  providers: [ReferentialService],
})
export class ReferentialModule {}
