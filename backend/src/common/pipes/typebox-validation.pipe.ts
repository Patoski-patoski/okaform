import { PipeTransform, BadRequestException } from '@nestjs/common';
import { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/**
 * Coerce string values that should be numbers.
 * Express query params are always strings — this converts them before validation.
 */
function coerceQueryParams(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(coerceQueryParams);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) {
      result[key] = Number(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = coerceQueryParams(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export class TypeBoxValidationPipe<T extends TSchema> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): T['static'] {
    const coerced = coerceQueryParams(value);

    const errors = [...Value.Errors(this.schema, coerced)];
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errors.map((e) => ({
          path: e.path,
          message: e.message,
          value: e.value,
        })),
      });
    }
    return Value.Cast(this.schema, coerced);
  }
}
