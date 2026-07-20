import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class FormFullException extends OkaformException {
  constructor(formId: string, maxResponses: number) {
    super(
      {
        code: 'FORM_FULL',
        detail: `This survey has reached its maximum of ${maxResponses} responses.`,
        context: { formId, maxResponses },
      },
      HttpStatus.CONFLICT,
    );
  }
}
