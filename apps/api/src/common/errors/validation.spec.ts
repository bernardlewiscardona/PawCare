import type { ValidationError } from 'class-validator';
import { fieldErrorsFrom, validationFailed } from './validation.js';

describe('validationFailed', () => {
  it('builds a 400 VALIDATION_FAILED with a flat list and per-field messages', () => {
    const error = validationFailed({
      phone: ['Include the country code'],
      timeZone: ['Unknown time zone'],
    });
    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Request validation failed');
    expect(error.details).toEqual({
      errors: ['Include the country code', 'Unknown time zone'],
      fields: { phone: ['Include the country code'], timeZone: ['Unknown time zone'] },
    });
  });
});

describe('fieldErrorsFrom', () => {
  const error = (partial: Partial<ValidationError>): ValidationError =>
    ({ children: [], ...partial }) as ValidationError;

  it('maps each property to its constraint messages', () => {
    expect(
      fieldErrorsFrom([
        error({ property: 'version', constraints: { isInt: 'version must be an integer number' } }),
      ]),
    ).toEqual({ version: ['version must be an integer number'] });
  });

  it('names nested properties parent.child', () => {
    const child = error({ property: 'city', constraints: { isString: 'city must be a string' } });
    expect(fieldErrorsFrom([error({ property: 'address', children: [child] })])).toEqual({
      'address.city': ['city must be a string'],
    });
  });

  it('reports fields the whitelist rejects', () => {
    expect(
      fieldErrorsFrom([
        error({
          property: 'authSubject',
          constraints: { whitelistValidation: 'property authSubject should not exist' },
        }),
      ]),
    ).toEqual({ authSubject: ['property authSubject should not exist'] });
  });
});
