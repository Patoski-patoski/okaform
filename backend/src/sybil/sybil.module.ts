import { Module } from '@nestjs/common';
import { SybilService } from './sybil.service';
import { SybilController } from './sybil.controller';

@Module({
  controllers: [SybilController],
  providers: [SybilService],
  exports: [SybilService],
})
export class SybilModule {}
