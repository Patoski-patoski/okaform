import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class RpcErrorException extends OkaformException {
  constructor(operation: string, detail?: string) {
    super(
      {
        code: 'RPC_ERROR',
        detail: detail ?? `Solana RPC call failed during ${operation}.`,
        context: { operation },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
