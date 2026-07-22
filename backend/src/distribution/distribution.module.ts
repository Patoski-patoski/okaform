import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DistributionRecord,
  DistributionRecordSchema,
} from './distribution.schema';
import { DistributionService } from './distribution.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DistributionRecord.name, schema: DistributionRecordSchema },
    ]),
  ],
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}
