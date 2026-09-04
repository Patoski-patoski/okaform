import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class NonceNotRequestedException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'NONCE_NOT_REQUESTED',
        detail: 'Request a nonce before verifying.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
