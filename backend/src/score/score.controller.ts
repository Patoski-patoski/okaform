import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SolanaService } from '../solana/solana.service';
import { BuildInitScoreTxSchema } from './dto/build-init-score-tx.dto';
import type { BuildInitScoreTxDto } from './dto/build-init-score-tx.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';

@Controller('score')
export class ScoreController {
  constructor(private readonly solanaService: SolanaService) {}

  @Post('build-init-score-tx')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async buildInitScoreTx(
    @Body(new TypeBoxValidationPipe(BuildInitScoreTxSchema))
    dto: BuildInitScoreTxDto,
  ): Promise<{ tx: string; scorePda: string; exists: boolean }> {
    return await this.solanaService.buildInitScoreTx(dto.wallet, dto.blockhash);
  }
}
