import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { SurveyLifecycleService } from './survey-lifecycle.service';
import { FeeService } from './fee.service';
import { Form, FormSchema } from '../common/schemas/form.schema';
import {
  SurveyResponse,
  ResponseSchema,
} from '../common/schemas/response.schema';
import { SolanaModule } from '../solana/solana.module';
import { DistributionModule } from '../distribution/distribution.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: SurveyResponse.name, schema: ResponseSchema },
    ]),
    SolanaModule,
    DistributionModule,
  ],
  controllers: [FormsController],
  providers: [FormsService, SurveyLifecycleService, FeeService],
  exports: [FormsService, SurveyLifecycleService, FeeService],
})
export class FormsModule {}
