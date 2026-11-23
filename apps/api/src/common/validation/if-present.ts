import { ValidateIf } from 'class-validator';

/** Validate when the field is present, including null (IsOptional would let null through). */
export const IfPresent = () => ValidateIf((_object, value) => value !== undefined);
