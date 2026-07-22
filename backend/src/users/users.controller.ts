import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  UsersService,
  UserProfileResponse,
  SurveyHistoryItem,
} from './users.service';
import { SetUsernameSchema } from './dto/set-username.dto';
import type { SetUsernameDto } from './dto/set-username.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { DistributionService } from '../distribution/distribution.service';
import type { DistributionRecord } from '../distribution/distribution.schema';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly distributionService: DistributionService,
  ) {}

  @Get(':wallet')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getProfile(
    @Param('wallet') wallet: string,
  ): Promise<UserProfileResponse> {
    return await this.usersService.getProfileByWallet(wallet);
  }

  @Post('username')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async setUsername(
    @CurrentUser() user: UserProfile,
    @Body(new TypeBoxValidationPipe(SetUsernameSchema)) dto: SetUsernameDto,
  ): Promise<{ wallet: string; username: string }> {
    const wallet: string = String(user.wallet);
    const username: string = String(dto.username);
    return await this.usersService.setUsername(wallet, username);
  }

  @Get(':wallet/history')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getHistory(
    @Param('wallet') wallet: string,
  ): Promise<SurveyHistoryItem[]> {
    return await this.usersService.getSurveyHistory(wallet);
  }

  @Get(':wallet/earnings')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getEarnings(
    @Param('wallet') wallet: string,
  ): Promise<DistributionRecord[]> {
    return await this.distributionService.getEarningsByWallet(wallet);
  }
}
