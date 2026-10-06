import {
  createEventSchema,
  updateEventSchema,
  createRoundSchema,
  updateRoundSchema,
  setRegistrationStatusSchema,
} from '../validators/events.validator';

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

function getErrors(schema: any, data: any): string {
  const { error } = schema.validate(data, { abortEarly: false });
  return error ? error.details.map((d: any) => d.message).join(' ') : '';
}

function getValidated(schema: any, data: any): any {
  const { value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  return value;
}

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

// ───── createEventSchema ─────

describe('createEventSchema', () => {
  it('accepts title-only (minimal)', () => {
    expect(isValid(createEventSchema, { title: 'CodeVita 2026' })).toBe(true);
  });

  it('accepts all fields', () => {
    expect(isValid(createEventSchema, {
      title: 'GSoC 2026',
      description: 'Open source program',
      category: 'CODING',
      isMandatory: true,
      batchIds: [UUID, UUID2],
      mode: 'ONLINE',
      officialLink: 'https://summerofcode.withgoogle.com',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
      venue: 'Virtual',
      fee: 0,
    })).toBe(true);
  });

  it('rejects missing title', () => {
    expect(isValid(createEventSchema, {})).toBe(false);
    expect(getErrors(createEventSchema, {}).toLowerCase()).toContain('title');
  });

  it('rejects empty string title', () => {
    expect(isValid(createEventSchema, { title: '' })).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(isValid(createEventSchema, { title: 'Test', category: 'INVALID' })).toBe(false);
  });

  it('rejects invalid mode', () => {
    expect(isValid(createEventSchema, { title: 'Test', mode: 'HYBRID' })).toBe(false);
  });

  it('rejects non-UUID batchIds', () => {
    expect(isValid(createEventSchema, { title: 'Test', batchIds: ['not-a-uuid'] })).toBe(false);
  });

  it('rejects duplicate batchIds', () => {
    expect(isValid(createEventSchema, { title: 'Test', batchIds: [UUID, UUID] })).toBe(false);
  });

  it('defaults category to OTHER', () => {
    const val = getValidated(createEventSchema, { title: 'Test' });
    expect(val.category).toBe('OTHER');
  });

  it('defaults isMandatory to false', () => {
    const val = getValidated(createEventSchema, { title: 'Test' });
    expect(val.isMandatory).toBe(false);
  });

  it('defaults batchIds to []', () => {
    const val = getValidated(createEventSchema, { title: 'Test' });
    expect(val.batchIds).toEqual([]);
  });

  it('accepts valid URI for officialLink', () => {
    expect(isValid(createEventSchema, { title: 'Test', officialLink: 'https://example.com' })).toBe(true);
  });

  it('rejects invalid URI for officialLink', () => {
    expect(isValid(createEventSchema, { title: 'Test', officialLink: 'not-a-uri' })).toBe(false);
  });
});

// ───── updateEventSchema ─────

describe('updateEventSchema', () => {
  it('accepts partial update (title only)', () => {
    expect(isValid(updateEventSchema, { title: 'New Title' })).toBe(true);
  });

  it('accepts addBatchIds', () => {
    expect(isValid(updateEventSchema, { addBatchIds: [UUID] })).toBe(true);
  });

  it('accepts null for clearable fields', () => {
    expect(isValid(updateEventSchema, { startDate: null })).toBe(true);
    expect(isValid(updateEventSchema, { endDate: null })).toBe(true);
    expect(isValid(updateEventSchema, { mode: null })).toBe(true);
  });

  it('rejects empty object', () => {
    expect(isValid(updateEventSchema, {})).toBe(false);
    expect(getErrors(updateEventSchema, {}).toLowerCase()).toContain('at least');
  });

  it('rejects duplicate addBatchIds', () => {
    expect(isValid(updateEventSchema, { addBatchIds: [UUID, UUID] })).toBe(false);
  });

  it('accepts isMandatory change', () => {
    expect(isValid(updateEventSchema, { isMandatory: true })).toBe(true);
  });
});

// ───── createRoundSchema ─────

describe('createRoundSchema', () => {
  it('accepts minimal (name only)', () => {
    expect(isValid(createRoundSchema, { name: 'Round 1' })).toBe(true);
  });

  it('accepts all fields', () => {
    expect(isValid(createRoundSchema, {
      name: 'Round 1',
      roundDate: '2026-10-15T00:00:00.000Z',
      deadline: '2026-10-14T00:00:00.000Z',
      status: 'ONGOING',
    })).toBe(true);
  });

  it('rejects missing name', () => {
    expect(isValid(createRoundSchema, {})).toBe(false);
    expect(getErrors(createRoundSchema, {})).toContain('name');
  });

  it('rejects invalid status', () => {
    expect(isValid(createRoundSchema, { name: 'R1', status: 'FINISHED' })).toBe(false);
  });

  it('defaults status to UPCOMING', () => {
    const val = getValidated(createRoundSchema, { name: 'R1' });
    expect(val.status).toBe('UPCOMING');
  });

  it('accepts null roundDate', () => {
    expect(isValid(createRoundSchema, { name: 'R1', roundDate: null })).toBe(true);
  });
});

// ───── updateRoundSchema ─────

describe('updateRoundSchema', () => {
  it('accepts name only', () => {
    expect(isValid(updateRoundSchema, { name: 'Updated' })).toBe(true);
  });

  it('accepts status only', () => {
    expect(isValid(updateRoundSchema, { status: 'DONE' })).toBe(true);
  });

  it('rejects empty object', () => {
    expect(isValid(updateRoundSchema, {})).toBe(false);
    expect(getErrors(updateRoundSchema, {}).toLowerCase()).toContain('at least');
  });

  it('accepts null roundDate', () => {
    expect(isValid(updateRoundSchema, { roundDate: null })).toBe(true);
  });
});

// ───── setRegistrationStatusSchema ─────

describe('setRegistrationStatusSchema', () => {
  it('accepts INTERESTED', () => {
    expect(isValid(setRegistrationStatusSchema, { status: 'INTERESTED' })).toBe(true);
  });

  it('accepts REGISTERED', () => {
    expect(isValid(setRegistrationStatusSchema, { status: 'REGISTERED' })).toBe(true);
  });

  it('accepts WITHDRAWN', () => {
    expect(isValid(setRegistrationStatusSchema, { status: 'WITHDRAWN' })).toBe(true);
  });

  it('rejects PENDING', () => {
    expect(isValid(setRegistrationStatusSchema, { status: 'PENDING' })).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(isValid(setRegistrationStatusSchema, { status: 'ACTIVE' })).toBe(false);
  });

  it('rejects missing status', () => {
    expect(isValid(setRegistrationStatusSchema, {})).toBe(false);
  });
});
