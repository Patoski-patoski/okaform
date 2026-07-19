import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import {
  SurveyResponse,
  ResponseSchema,
} from '../common/schemas/response.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SurveyResponse.name, schema: ResponseSchema },
    ]),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
