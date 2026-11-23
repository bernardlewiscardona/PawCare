/** A field rule's rejection, carrying the message shown next to the field. */
export interface RuleError {
  error: string;
}

export function isRuleError(value: unknown): value is RuleError {
  return typeof value === 'object' && value !== null && 'error' in value;
}
