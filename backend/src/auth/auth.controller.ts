import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthTokensResponse, TokenPairResponse } from './auth.service';
import { AuthService } from './auth.service';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { GetNonceSchema } from './dto/get-nonce.dto';
import type { GetNonceDto } from './dto/get-nonce.dto';
import { VerifySignatureSchema } from './dto/verify-signature.dto';
import type { VerifySignatureDto } from './dto/verify-signature.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async getNonce(
    @Body(new TypeBoxValidationPipe(GetNonceSchema)) dto: GetNonceDto,
  ): Promise<{ nonce: string; message: string }> {
    return this.authService.generateNonce(dto.wallet);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async verify(
    @Body(new TypeBoxValidationPipe(VerifySignatureSchema))
    dto: VerifySignatureDto,
  ): Promise<AuthTokensResponse> {
    return this.authService.verifySignature(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: UserProfile): UserProfile {
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenPairResponse> {
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body('refreshToken') refreshToken: string,
  ): Promise<{ message: string }> {
    await this.authService.logout(refreshToken);
    return { message: 'Logged out successfully' };
  }
}
