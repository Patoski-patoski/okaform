import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubmissionsService, type SubmissionItem } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get(':formId')
  @UseGuards(JwtAuthGuard)
  async getSubmissions(
    @Param('formId') formId: string,
  ): Promise<SubmissionItem[]> {
    return await this.submissionsService.getSubmissionsByForm(formId);
  }
}
