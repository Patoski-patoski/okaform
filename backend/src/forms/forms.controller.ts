import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  FormsService,
  CreateFormResult,
  FormListItem,
  FormDetail,
  ExploreFormItem,
  AnalyticsAggregate,
} from './forms.service';
import { CreateFormSchema } from './dto/create-form.dto';
import type { CreateFormDto } from './dto/create-form.dto';
import { BuildInitTxSchema } from './dto/build-init-tx.dto';
import type { BuildInitTxDto } from './dto/build-init-tx.dto';
import { BuildCloseTxSchema } from './dto/build-close-tx.dto';
import type { BuildCloseTxDto } from './dto/build-close-tx.dto';
import { ConfirmDistributeSchema } from './dto/confirm-distribute.dto';
import type { ConfirmDistributeDto } from './dto/confirm-distribute.dto';
import { ConfirmCloseEscrowSchema } from './dto/confirm-close-escrow.dto';
import type { ConfirmCloseEscrowDto } from './dto/confirm-close-escrow.dto';
import { UpdateSurveySettingsSchema } from './dto/update-survey-settings.dto';
import type { UpdateSurveySettingsDto } from './dto/update-survey-settings.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { DistributionService } from '../distribution/distribution.service';
import type { DistributionRecord } from '../distribution/distribution.schema';
import { FeeService } from './fee.service';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly distributionService: DistributionService,
    private readonly feeService: FeeService,
  ) {}

  @Post('build-init-tx')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async buildInitTx(
    @Body(new TypeBoxValidationPipe(BuildInitTxSchema)) dto: BuildInitTxDto,
  ): Promise<{ tx: string; surveyPda: string; escrowPda: string }> {
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

  @Post(':id/close')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async buildCloseTx(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(BuildCloseTxSchema)) dto: BuildCloseTxDto,
  ): Promise<{ tx: string }> {
    return await this.formsService.buildCloseTx(id, user.wallet, dto.blockhash);
  }

  @Post(':id/confirm-close')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmClose(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
  ): Promise<void> {
    await this.formsService.confirmClose(id, user.wallet);
  }

  @Post(':id/build-distribute-tx')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async buildDistributeTx(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(BuildCloseTxSchema)) dto: BuildCloseTxDto,
  ): Promise<{
    txs: string[];
    participantWallets: string[][];
    amounts: number[][];
    badgeTiers: Record<string, string>;
    recovered?: boolean;
  }> {
    return await this.formsService.buildDistributeTx(
      id,
      user.wallet,
      dto.blockhash,
    );
  }

  @Post(':id/confirm-distribute')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmDistribute(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(ConfirmDistributeSchema))
    dto: ConfirmDistributeDto,
  ): Promise<void> {
    await this.formsService.confirmDistribute(
      id,
      user.wallet,
      dto.participantWallets,
      dto.amounts,
      dto.txSignature,
      dto.badgeTiers,
      dto.isLastBatch,
    );
  }

  @Post(':id/build-close-escrow-tx')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async buildCloseEscrowTx(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(BuildCloseTxSchema)) dto: BuildCloseTxDto,
  ): Promise<{ tx: string }> {
    return await this.formsService.buildCloseEscrowTx(
      id,
      user.wallet,
      dto.blockhash,
    );
  }

  @Post(':id/confirm-close-escrow')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmCloseEscrow(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(ConfirmCloseEscrowSchema))
    dto: ConfirmCloseEscrowDto,
  ): Promise<void> {
    await this.formsService.confirmCloseEscrow(
      id,
      user.wallet,
      dto.txSignature,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getForms(@CurrentUser() user: UserProfile): Promise<FormListItem[]> {
    return await this.formsService.getFormsByCreator(user.wallet);
  }

  @Get('explore')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getExploreForms(): Promise<ExploreFormItem[]> {
    return await this.formsService.getExploreForms();
  }

  @Get('config')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getFormConfig(): {
    protocolFeeBps: number;
    protocolFeeWallet: string;
  } {
    return {
      protocolFeeBps: this.feeService.getFeeBps(),
      protocolFeeWallet: this.feeService.getFeeWallet(),
    };
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getAnalytics(
    @CurrentUser() user: UserProfile,
  ): Promise<AnalyticsAggregate> {
    return await this.formsService.getAnalyticsForCreator(user.wallet);
  }

  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateSurveySettings(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(UpdateSurveySettingsSchema))
    dto: UpdateSurveySettingsDto,
  ): Promise<FormDetail> {
    return await this.formsService.updateSurveySettings(id, user.wallet, dto);
  }

  @Delete(':id/data')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async deleteSurveyData(
    @Param('id') id: string,
    @CurrentUser() user: UserProfile,
  ): Promise<void> {
    await this.formsService.deleteSurveyData(id, user.wallet);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getFormById(@Param('id') id: string): Promise<FormDetail> {
    return await this.formsService.getFormById(id);
  }

  @Get(':formId/distribution')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getDistribution(
    @Param('formId') formId: string,
    @CurrentUser() user: UserProfile,
  ): Promise<DistributionRecord[]> {
    const form = await this.formsService.getFormById(formId);
    if (form.creator !== user.wallet) {
      throw new ForbiddenException(
        'Only the form creator can view distribution records.',
      );
    }
    return await this.distributionService.getDistributionByForm(formId);
  }
}
