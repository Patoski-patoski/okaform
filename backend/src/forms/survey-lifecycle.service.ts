import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { SolanaService } from '../solana/solana.service';

/**
 * Handles survey lifecycle events: auto-close when max responses is reached.
 * This service is called after each submission to check if the survey should be closed.
 */
@Injectable()
export class SurveyLifecycleService {
  private readonly logger = new Logger(SurveyLifecycleService.name);

  constructor(
    @InjectModel(Form.name) private formModel: Model<Form>,
    @InjectModel(SurveyResponse.name)
    private responseModel: Model<SurveyResponse>,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Check if a survey has reached max responses and auto-close if so.
   * Called after each successful submission.
   */
  async checkAndCloseIfFull(formId: string): Promise<boolean> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({
        event: 'AUTO_CLOSE_FORM_NOT_FOUND',
        formId,
      });
      return false;
    }

    if (form.status !== 'active') {
      return false;
    }

    // Check if response count has reached max
    const responseCount = await this.responseModel
      .countDocuments({ formId })
      .exec();
    const maxResponses = form.maxResponses;

    if (responseCount < maxResponses) {
      return false;
    }

    // Max responses reached — auto-close
    this.logger.log({
      event: 'AUTO_CLOSE_TRIGGERED',
      formId,
      responseCount,
      maxResponses,
      creator: form.creator.slice(0, 8) + '...',
    });

    try {
      // Close on-chain
      const { txSignature } = await this.solanaService.closeSurvey(
        form.creator,
        form.onChain?.surveyId ?? formId,
      );

      // Update status in MongoDB
      form.status = 'closed';
      await form.save();

      this.logger.log({
        event: 'AUTO_CLOSE_SUCCESS',
        formId,
        txSignature,
      });

      return true;
    } catch (error) {
      this.logger.error({
        event: 'AUTO_CLOSE_FAILED',
        formId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
