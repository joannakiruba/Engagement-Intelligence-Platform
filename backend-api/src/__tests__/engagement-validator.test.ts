import {
  dateRangeQuerySchema,
  batchParamsSchema,
  studentParamsSchema,
  studentQuerySchema,
} from '../validators/engagement.validator';

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('dateRangeQuerySchema', () => {
  it('accepts empty object', () => {
    expect(isValid(dateRangeQuerySchema, {})).toBe(true);
  });

  it('accepts valid from date', () => {
    expect(isValid(dateRangeQuerySchema, { from: '2026-01-01' })).toBe(true);
  });

  it('accepts valid from and to dates', () => {
    expect(isValid(dateRangeQuerySchema, { from: '2026-01-01', to: '2026-12-31' })).toBe(true);
  });

  it('accepts ISO datetime strings', () => {
    expect(isValid(dateRangeQuerySchema, { from: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('rejects invalid from date', () => {
    expect(isValid(dateRangeQuerySchema, { from: 'not-a-date' })).toBe(false);
  });

  it('rejects invalid to date', () => {
    expect(isValid(dateRangeQuerySchema, { to: 'bad' })).toBe(false);
  });
});

describe('batchParamsSchema', () => {
  it('accepts valid UUID', () => {
    expect(isValid(batchParamsSchema, { batchId: UUID })).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(isValid(batchParamsSchema, { batchId: 'not-uuid' })).toBe(false);
  });

  it('rejects missing batchId', () => {
    expect(isValid(batchParamsSchema, {})).toBe(false);
  });
});

describe('studentParamsSchema', () => {
  it('accepts valid UUID', () => {
    expect(isValid(studentParamsSchema, { studentId: UUID })).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(isValid(studentParamsSchema, { studentId: 'bad' })).toBe(false);
  });

  it('rejects missing studentId', () => {
    expect(isValid(studentParamsSchema, {})).toBe(false);
  });
});

describe('studentQuerySchema', () => {
  it('accepts empty object', () => {
    expect(isValid(studentQuerySchema, {})).toBe(true);
  });

  it('accepts batchId with dates', () => {
    expect(isValid(studentQuerySchema, {
      batchId: UUID,
      from: '2026-01-01',
      to: '2026-12-31',
    })).toBe(true);
  });

  it('accepts only batchId', () => {
    expect(isValid(studentQuerySchema, { batchId: UUID })).toBe(true);
  });

  it('rejects invalid batchId', () => {
    expect(isValid(studentQuerySchema, { batchId: 'not-uuid' })).toBe(false);
  });

  it('rejects invalid from date', () => {
    expect(isValid(studentQuerySchema, { from: 'bad-date' })).toBe(false);
  });
});
