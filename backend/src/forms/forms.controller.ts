import {
  Controller,
  Get,
  Post,
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
} from './forms.service';
import { CreateFormSchema } from './dto/create-form.dto';
import type { CreateFormDto } from './dto/create-form.dto';
import { BuildInitTxSchema } from './dto/build-init-tx.dto';
import type { BuildInitTxDto } from './dto/build-init-tx.dto';
import { BuildCloseTxSchema } from './dto/build-close-tx.dto';
import type { BuildCloseTxDto } from './dto/build-close-tx.dto';
import { ConfirmDistributeSchema } from './dto/confirm-distribute.dto';
import type { ConfirmDistributeDto } from './dto/confirm-distribute.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { DistributionService } from '../distribution/distribution.service';
import type { DistributionRecord } from '../distribution/distribution.schema';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly distributionService: DistributionService,
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
  ): Promise<{ tx: string; participantWallets: string[]; amounts: number[] }> {
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
    );
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

  @Get(':id')
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
