import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { SubmissionsService, type SubmissionItem } from './submissions.service';
import { ModerateResponseSchema } from './dto/moderate-response.dto';
import type { ModerateResponseDto } from './dto/moderate-response.dto';
import { ListResponsesQuerySchema } from './dto/list-responses-query.dto';
import type { ListResponsesQueryDto } from './dto/list-responses-query.dto';

@Controller('forms')
export class ResponsesController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get(':formId/responses')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getResponses(
    @Param('formId') formId: string,
    @Query(new TypeBoxValidationPipe(ListResponsesQuerySchema))
    query: ListResponsesQueryDto,
  ): Promise<SubmissionItem[]> {
    return await this.submissionsService.getSubmissionsByForm(
      formId,
      query.moderationStatus,
    );
  }

  @Patch(':formId/responses/:responseId/moderate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async moderateResponse(
    @Param('formId') formId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(ModerateResponseSchema))
    dto: ModerateResponseDto,
  ): Promise<void> {
    await this.submissionsService.moderateResponse(
      formId,
      responseId,
      user.wallet,
      dto,
    );
  }
}
