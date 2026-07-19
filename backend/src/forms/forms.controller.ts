import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  FormsService,
  CreateFormResult,
  FormListItem,
  FormDetail,
  ExploreFormItem,
} from './forms.service';
import { CreateFormSchema } from './dto/create-form.dto';
import type { CreateFormDto } from './dto/create-form.dto';
import { BuildInitTxSchema } from './dto/build-init-tx.dto';
import type { BuildInitTxDto } from './dto/build-init-tx.dto';
import { SubmitResponseSchema } from './dto/submit-response.dto';
import type { SubmitResponseDto } from './dto/submit-response.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { SubmissionsService } from '../submissions/submissions.service';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Post('build-init-tx')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async buildInitTx(
    @Body(new TypeBoxValidationPipe(BuildInitTxSchema)) dto: BuildInitTxDto,
  ): Promise<{ tx: string }> {
    return await this.formsService.buildInitializeTx(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createForm(
    @Body(new TypeBoxValidationPipe(CreateFormSchema)) dto: CreateFormDto,
    @CurrentUser() user: UserProfile,
  ): Promise<CreateFormResult> {
    return await this.formsService.createForm(dto, user.wallet);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getForms(@CurrentUser() user: UserProfile): Promise<FormListItem[]> {
    return await this.formsService.getFormsByCreator(user.wallet);
  }

  @Get('explore')
  async getExploreForms(): Promise<ExploreFormItem[]> {
    return await this.formsService.getExploreForms();
  }

  @Post(':id/submit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async submitResponse(
    @Param('id') formId: string,
    @Body(new TypeBoxValidationPipe(SubmitResponseSchema))
    dto: SubmitResponseDto,
  ) {
    return await this.submissionsService.createSubmission(
      formId,
      dto.respondentWallet,
      dto.answers,
    );
  }

  @Get(':id')
  async getFormById(@Param('id') id: string): Promise<FormDetail> {
    return await this.formsService.getFormById(id);
  }
}
