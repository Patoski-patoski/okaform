import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  FormsService,
  CreateFormResult,
  FormListItem,
  FormDetail,
} from './forms.service';
import { CreateFormSchema } from './dto/create-form.dto';
import type { CreateFormDto } from './dto/create-form.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

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

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getFormById(@Param('id') id: string): Promise<FormDetail> {
    return await this.formsService.getFormById(id);
  }
}
