import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class SurveyStillActiveException extends OkaformException {
  constructor(formId: string) {
    super(
      {
        code: 'SURVEY_STILL_ACTIVE',
        detail: 'Close the survey before deleting its data.',
        context: { formId },
      },
      HttpStatus.CONFLICT,
    );
  }
}
