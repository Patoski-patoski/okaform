import { HttpException, HttpStatus } from '@nestjs/common';

export interface ExceptionMeta {
  code: string;
  detail?: string;
  context?: Record<string, unknown>;
}

export class OkaformException extends HttpException {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(meta: ExceptionMeta, status: HttpStatus) {
    super({ message: meta.detail ?? meta.code, code: meta.code }, status);
    this.code = meta.code;
    this.context = meta.context ?? {};
  }
}
