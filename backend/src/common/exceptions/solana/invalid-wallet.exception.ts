import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class InvalidWalletException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'INVALID_WALLET',
        detail: 'The provided wallet address is not a valid Solana public key.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
