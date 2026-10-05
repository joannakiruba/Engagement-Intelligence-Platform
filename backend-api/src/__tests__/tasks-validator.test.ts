import {
  createTaskSchema,
  updateTaskSchema,
  changeDeadlineSchema,
  updateProgressSchema,
  addStudentSchema,
  setMarksSchema,
  bulkSetMarksSchema,
} from '../validators/tasks.validator';

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

function getErrors(schema: any, data: any): string {
  const { error } = schema.validate(data, { abortEarly: false });
  return error ? error.details.map((d: any) => d.message).join(' | ') : '';
}

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';
const FUTURE_DATE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST_DATE = '2020-01-01T00:00:00.000Z';

describe('createTaskSchema', () => {
  const valid = {
    title: 'Build a REST API',
    batchIds: [UUID],
    isMandatory: true,
    isInternal: false,
  };

  it('accepts minimal valid input', () => {
    expect(isValid(createTaskSchema, valid)).toBe(true);
  });

  it('accepts with all optional fields', () => {
    expect(isValid(createTaskSchema, {
      ...valid,
      description: 'Some description',
      isInternal: true,
      maxMarks: 100,
      deadlineType: 'FIXED',
      deadline: FUTURE_DATE,
    })).toBe(true);
  });

  it('rejects missing title', () => {
    const { title, ...rest } = valid;
    expect(isValid(createTaskSchema, rest)).toBe(false);
  });

  it('rejects empty batchIds', () => {
    expect(isValid(createTaskSchema, { ...valid, batchIds: [] })).toBe(false);
  });

  it('rejects non-uuid batchIds', () => {
    expect(isValid(createTaskSchema, { ...valid, batchIds: ['not-a-uuid'] })).toBe(false);
  });

  it('rejects duplicate batchIds', () => {
    expect(isValid(createTaskSchema, { ...valid, batchIds: [UUID, UUID] })).toBe(false);
  });

  it('requires maxMarks when isInternal is true', () => {
    const data = { ...valid, isInternal: true };
    expect(isValid(createTaskSchema, data)).toBe(false);
    expect(getErrors(createTaskSchema, data)).toContain('maxMarks is required');
  });

  it('rejects maxMarks when isInternal is false', () => {
    const data = { ...valid, isInternal: false, maxMarks: 100 };
    expect(isValid(createTaskSchema, data)).toBe(false);
    expect(getErrors(createTaskSchema, data)).toContain('maxMarks is not allowed');
  });

  it('requires deadline when deadlineType is FIXED', () => {
    const data = { ...valid, deadlineType: 'FIXED' };
    expect(isValid(createTaskSchema, data)).toBe(false);
    expect(getErrors(createTaskSchema, data)).toContain('deadline is required');
  });

  it('rejects past FIXED deadline', () => {
    const data = { ...valid, deadlineType: 'FIXED', deadline: PAST_DATE };
    expect(isValid(createTaskSchema, data)).toBe(false);
    expect(getErrors(createTaskSchema, data)).toContain('future');
  });

  it('rejects deadline for non-FIXED types', () => {
    const data = { ...valid, deadlineType: 'TBD', deadline: FUTURE_DATE };
    expect(isValid(createTaskSchema, data)).toBe(false);
  });

  it('allows deadlineNote only for TENTATIVE or TBD', () => {
    expect(isValid(createTaskSchema, {
      ...valid, deadlineType: 'TENTATIVE', deadlineNote: 'Maybe next week',
    })).toBe(true);

    expect(isValid(createTaskSchema, {
      ...valid, deadlineType: 'NONE', deadlineNote: 'Note',
    })).toBe(false);
  });

  it('rejects invalid deadlineType', () => {
    expect(isValid(createTaskSchema, { ...valid, deadlineType: 'INVALID' })).toBe(false);
  });
});

describe('updateTaskSchema', () => {
  it('accepts valid partial update', () => {
    expect(isValid(updateTaskSchema, { title: 'New Title' })).toBe(true);
  });

  it('accepts addBatchIds', () => {
    expect(isValid(updateTaskSchema, { addBatchIds: [UUID] })).toBe(true);
  });

  it('rejects empty object', () => {
    expect(isValid(updateTaskSchema, {})).toBe(false);
  });

  it('rejects duplicate addBatchIds', () => {
    expect(isValid(updateTaskSchema, { addBatchIds: [UUID, UUID] })).toBe(false);
  });

  it('rejects maxMarks when setting isInternal to false', () => {
    expect(isValid(updateTaskSchema, { isInternal: false, maxMarks: 100 })).toBe(false);
  });

  it('accepts null maxMarks', () => {
    expect(isValid(updateTaskSchema, { maxMarks: null })).toBe(true);
  });

  it('rejects negative maxMarks', () => {
    expect(isValid(updateTaskSchema, { maxMarks: -10 })).toBe(false);
  });
});

describe('changeDeadlineSchema', () => {
  it('accepts FIXED with future deadline', () => {
    expect(isValid(changeDeadlineSchema, {
      deadlineType: 'FIXED',
      deadline: FUTURE_DATE,
    })).toBe(true);
  });

  it('accepts NONE without deadline', () => {
    expect(isValid(changeDeadlineSchema, { deadlineType: 'NONE' })).toBe(true);
  });

  it('accepts TBD with note', () => {
    expect(isValid(changeDeadlineSchema, {
      deadlineType: 'TBD',
      deadlineNote: 'Will confirm later',
      reason: 'Schedule changed',
    })).toBe(true);
  });

  it('rejects FIXED without deadline', () => {
    expect(isValid(changeDeadlineSchema, { deadlineType: 'FIXED' })).toBe(false);
  });

  it('rejects FIXED with past deadline', () => {
    expect(isValid(changeDeadlineSchema, {
      deadlineType: 'FIXED',
      deadline: PAST_DATE,
    })).toBe(false);
  });

  it('rejects missing deadlineType', () => {
    expect(isValid(changeDeadlineSchema, {})).toBe(false);
  });
});

describe('updateProgressSchema', () => {
  it('accepts valid progress values', () => {
    for (const p of ['NOT_STARTED', 'IN_PROGRESS', 'ALMOST_COMPLETED', 'COMPLETED']) {
      expect(isValid(updateProgressSchema, { progress: p })).toBe(true);
    }
  });

  it('rejects invalid progress', () => {
    expect(isValid(updateProgressSchema, { progress: 'DONE' })).toBe(false);
  });

  it('rejects missing progress', () => {
    expect(isValid(updateProgressSchema, {})).toBe(false);
  });
});

describe('addStudentSchema', () => {
  it('accepts valid UUID', () => {
    expect(isValid(addStudentSchema, { studentId: UUID })).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(isValid(addStudentSchema, { studentId: 'not-a-uuid' })).toBe(false);
  });

  it('rejects missing studentId', () => {
    expect(isValid(addStudentSchema, {})).toBe(false);
  });
});

describe('setMarksSchema', () => {
  it('accepts valid marks', () => {
    expect(isValid(setMarksSchema, { studentId: UUID, marksAwarded: 85 })).toBe(true);
  });

  it('accepts null marks (ungrade)', () => {
    expect(isValid(setMarksSchema, { studentId: UUID, marksAwarded: null })).toBe(true);
  });

  it('accepts zero marks', () => {
    expect(isValid(setMarksSchema, { studentId: UUID, marksAwarded: 0 })).toBe(true);
  });

  it('rejects negative marks', () => {
    expect(isValid(setMarksSchema, { studentId: UUID, marksAwarded: -5 })).toBe(false);
  });

  it('rejects missing studentId', () => {
    expect(isValid(setMarksSchema, { marksAwarded: 85 })).toBe(false);
  });
});

describe('bulkSetMarksSchema', () => {
  it('accepts valid entries', () => {
    expect(isValid(bulkSetMarksSchema, {
      entries: [
        { studentId: UUID, marksAwarded: 90 },
        { studentId: UUID2, marksAwarded: 85 },
      ],
    })).toBe(true);
  });

  it('rejects empty entries', () => {
    expect(isValid(bulkSetMarksSchema, { entries: [] })).toBe(false);
  });

  it('rejects missing entries', () => {
    expect(isValid(bulkSetMarksSchema, {})).toBe(false);
  });

  it('rejects entry with invalid studentId', () => {
    expect(isValid(bulkSetMarksSchema, {
      entries: [{ studentId: 'bad', marksAwarded: 90 }],
    })).toBe(false);
  });
});
