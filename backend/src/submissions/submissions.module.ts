import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import {
  SurveyResponse,
  ResponseSchema,
} from '../common/schemas/response.schema';
import { Form, FormSchema } from '../common/schemas/form.schema';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SurveyResponse.name, schema: ResponseSchema },
      { name: Form.name, schema: FormSchema },
    ]),
    forwardRef(() => FormsModule),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
