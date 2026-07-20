import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubmissionsService, type SubmissionItem } from './submissions.service';
import { SubmitResponseSchema } from '../forms/dto/submit-response.dto';
import type { SubmitResponseDto } from '../forms/dto/submit-response.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post(':formId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async submitResponse(
    @Param('formId') formId: string,
    @Body(new TypeBoxValidationPipe(SubmitResponseSchema))
    dto: SubmitResponseDto,
  ) {
    return await this.submissionsService.createSubmission(
      formId,
      dto.respondentWallet,
      dto.answers,
    );
  }

  @Get(':formId')
  @UseGuards(JwtAuthGuard)
  async getSubmissions(
    @Param('formId') formId: string,
  ): Promise<SubmissionItem[]> {
    return await this.submissionsService.getSubmissionsByForm(formId);
  }
}
