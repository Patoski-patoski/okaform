import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { SurveyLifecycleService } from './survey-lifecycle.service';
import { Form, FormSchema } from '../common/schemas/form.schema';
import {
  SurveyResponse,
  ResponseSchema,
} from '../common/schemas/response.schema';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: SurveyResponse.name, schema: ResponseSchema },
    ]),
    SolanaModule,
  ],
  controllers: [FormsController],
  providers: [FormsService, SurveyLifecycleService],
  exports: [FormsService, SurveyLifecycleService],
})
export class FormsModule {}
