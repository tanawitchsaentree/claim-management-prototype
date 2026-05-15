export interface MockValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FieldRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export const FNOL_FIELD_RULES: Record<string, FieldRule> = {
  policyNumber:    { required: true, pattern: /^POL-\d{4}-\d{3}$/ },
  lossDate:        { required: true },
  lossDescription: { required: true, minLength: 10, maxLength: 2000 },
  lossAmount:      { required: true, min: 0, max: 999_999_999 },
  currency:        { required: true },
  submitter:       { required: true, minLength: 2, maxLength: 100 },
};

export const CLAIM_FIELD_RULES: Record<string, FieldRule> = {
  claimNumber:     { required: true },
  policyNumber:    { required: true },
  status:          { required: true },
  lineOfBusiness:  { required: true },
  currency:        { required: true },
  claimAmount:     { required: true, min: 0, max: 999_999_999 },
  handler:         { required: true },
};

export function validateFnol(data: Record<string, unknown>): MockValidationError[] {
  const errors: MockValidationError[] = [];

  for (const [field, rules] of Object.entries(FNOL_FIELD_RULES)) {
    const value = data[field];
    errors.push(...applyRules(field, value, rules));
  }

  // Cross-field: lossDate must not be in the future
  if (data['lossDate']) {
    const loss = new Date(data['lossDate'] as string);
    if (loss > new Date()) {
      errors.push({ field: 'lossDate', message: 'Loss date cannot be in the future', code: 'DATE_FUTURE' });
    }
  }

  return errors;
}

export function validateClaim(data: Record<string, unknown>): MockValidationError[] {
  const errors: MockValidationError[] = [];

  for (const [field, rules] of Object.entries(CLAIM_FIELD_RULES)) {
    const value = data[field];
    errors.push(...applyRules(field, value, rules));
  }

  return errors;
}

function applyRules(field: string, value: unknown, rules: FieldRule): MockValidationError[] {
  const errors: MockValidationError[] = [];

  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push({ field, message: `${field} is required`, code: 'REQUIRED' });
    return errors; // no further checks if missing
  }

  if (value === undefined || value === null || value === '') return errors;

  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push({ field, message: `${field} must be at least ${rules.minLength} characters`, code: 'MIN_LENGTH' });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters`, code: 'MAX_LENGTH' });
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({ field, message: `${field} format is invalid`, code: 'PATTERN' });
    }
  }

  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push({ field, message: `${field} must be at least ${rules.min}`, code: 'MIN_VALUE' });
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push({ field, message: `${field} must be at most ${rules.max}`, code: 'MAX_VALUE' });
    }
  }

  return errors;
}
