import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class InvalidSignatureException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'INVALID_SIGNATURE',
        detail: 'Signature verification failed.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
