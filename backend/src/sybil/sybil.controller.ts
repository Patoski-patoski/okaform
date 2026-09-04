import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SybilService } from './sybil.service';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { SybilCheckSchema } from './dto/sybil-check.dto';
import type { SybilCheckDto, SybilResult } from './dto/sybil-check.dto';

@Controller('sybil')
export class SybilController {
  constructor(private readonly sybilService: SybilService) {}

  @Get('check/:wallet')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async checkWallet(
    @Param('wallet') wallet: string,
    @Query(new TypeBoxValidationPipe(SybilCheckSchema)) query: SybilCheckDto,
  ): Promise<SybilResult> {
    const result = await this.sybilService.checkEligibility(wallet, query);
    return result;
  }
}
