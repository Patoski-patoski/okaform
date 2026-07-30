import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class TransactionFailedException extends OkaformException {
  constructor(txSignature: string, reason?: string) {
    super(
      {
        code: 'TRANSACTION_FAILED',
        detail: reason ?? `Solana transaction ${txSignature} did not succeed.`,
        context: { txSignature },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
