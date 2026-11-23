import { type ClassConstructor, plainToInstance } from 'class-transformer';
import { type ValidatorOptions, validateSync } from 'class-validator';
import { type FieldErrors, fieldErrorsFrom } from '../errors/validation.js';

/** The validator options of the global ValidationPipe (app.setup.ts). */
export const VALIDATOR_OPTIONS: ValidatorOptions = { whitelist: true, forbidNonWhitelisted: true };

/**
 * Validates a request body the way the global ValidationPipe does, but returns the field errors
 * instead of throwing, so a handler can report them in one 400 with errors found elsewhere (such
 * as a header). Take the body as `@Body() body: unknown`, which the global pipe leaves alone, and
 * document it with `@ApiBody({ type: Dto })`.
 */
export function validateBody<T extends object>(
  type: ClassConstructor<T>,
  body: unknown,
): { value: T; errors: FieldErrors } {
  const plain = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {};
  const value = plainToInstance(type, plain);
  return { value, errors: fieldErrorsFrom(validateSync(value, VALIDATOR_OPTIONS)) };
}
