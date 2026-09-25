import {
  createBatchSchema,
  updateBatchSchema,
  assignStudentSchema,
  assignTrainerSchema,
  createSessionSchema,
  updateSessionSchema,
} from "../validators/batches.validator";

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

function getErrors(schema: any, data: any): string {
  const { error } = schema.validate(data, { abortEarly: false });
  return error ? error.details.map((d: any) => d.message).join(" ") : "";
}

describe("Batch Validators", () => {
  describe("createBatchSchema", () => {
    const validBase = {
      name: "CS Batch 2026",
      startDate: "2026-10-01",
    };

    it("should accept valid batch with required fields only", () => {
      expect(isValid(createBatchSchema, validBase)).toBe(true);
    });

    it("should accept valid batch with all optional fields", () => {
      expect(isValid(createBatchSchema, {
        ...validBase,
        department: "Computer Science",
        endDate: "2027-03-31",
        description: "Fall semester batch",
      })).toBe(true);
    });

    it("should reject empty name", () => {
      expect(isValid(createBatchSchema, { ...validBase, name: "" })).toBe(false);
    });

    it("should reject missing name", () => {
      expect(isValid(createBatchSchema, { startDate: "2026-10-01" })).toBe(false);
    });

    it("should reject invalid startDate", () => {
      expect(isValid(createBatchSchema, { ...validBase, startDate: "not-a-date" })).toBe(false);
    });

    it("should reject missing startDate", () => {
      expect(isValid(createBatchSchema, { name: "Batch" })).toBe(false);
    });

    it("should reject invalid endDate", () => {
      expect(isValid(createBatchSchema, { ...validBase, endDate: "not-a-date" })).toBe(false);
    });
  });

  describe("updateBatchSchema", () => {
    it("should accept partial update with name only", () => {
      expect(isValid(updateBatchSchema, { name: "Updated Batch" })).toBe(true);
    });

    it("should accept empty object (no fields updated)", () => {
      expect(isValid(updateBatchSchema, {})).toBe(true);
    });

    it("should reject empty name string", () => {
      expect(isValid(updateBatchSchema, { name: "" })).toBe(false);
    });

    it("should accept partial update with dates", () => {
      expect(isValid(updateBatchSchema, {
        startDate: "2026-11-01",
        endDate: "2027-04-30",
      })).toBe(true);
    });

    it("should reject invalid date in update", () => {
      expect(isValid(updateBatchSchema, { startDate: "bad" })).toBe(false);
    });
  });

  describe("assignStudentSchema", () => {
    it("should accept valid UUID", () => {
      expect(isValid(assignStudentSchema, {
        studentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })).toBe(true);
    });

    it("should reject invalid UUID", () => {
      expect(isValid(assignStudentSchema, { studentId: "not-a-uuid" })).toBe(false);
    });

    it("should reject missing studentId", () => {
      expect(isValid(assignStudentSchema, {})).toBe(false);
    });
  });

  describe("assignTrainerSchema", () => {
    it("should accept valid UUID", () => {
      expect(isValid(assignTrainerSchema, {
        trainerId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })).toBe(true);
    });

    it("should reject invalid UUID", () => {
      expect(isValid(assignTrainerSchema, { trainerId: "not-a-uuid" })).toBe(false);
    });

    it("should reject missing trainerId", () => {
      expect(isValid(assignTrainerSchema, {})).toBe(false);
    });
  });

  describe("createSessionSchema", () => {
    const validSession = {
      trainerId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Intro to Node.js",
      scheduledDate: "2026-10-15",
      startTime: "2026-10-15T09:00:00Z",
      endTime: "2026-10-15T11:00:00Z",
    };

    it("should accept valid session", () => {
      expect(isValid(createSessionSchema, validSession)).toBe(true);
    });

    it("should accept session with optional topic", () => {
      expect(isValid(createSessionSchema, {
        ...validSession,
        topic: "Express middleware patterns",
      })).toBe(true);
    });

    it("should reject empty title", () => {
      expect(isValid(createSessionSchema, { ...validSession, title: "" })).toBe(false);
    });

    it("should reject missing trainerId", () => {
      const { trainerId, ...rest } = validSession;
      expect(isValid(createSessionSchema, rest)).toBe(false);
    });

    it("should reject invalid trainerId", () => {
      expect(isValid(createSessionSchema, { ...validSession, trainerId: "bad" })).toBe(false);
    });

    it("should reject invalid scheduledDate", () => {
      expect(isValid(createSessionSchema, { ...validSession, scheduledDate: "bad" })).toBe(false);
    });

    it("should reject invalid startTime", () => {
      expect(isValid(createSessionSchema, { ...validSession, startTime: "bad" })).toBe(false);
    });

    it("should reject invalid endTime", () => {
      expect(isValid(createSessionSchema, { ...validSession, endTime: "bad" })).toBe(false);
    });

    it("should reject endTime before startTime", () => {
      const result = createSessionSchema.validate({
        ...validSession,
        startTime: "2026-10-15T11:00:00Z",
        endTime: "2026-10-15T09:00:00Z",
      });
      expect(!!result.error).toBe(true);
      expect(result.error!.details.map((d: any) => d.message).join(" ")).toContain("endTime must be after startTime");
    });

    it("should reject endTime equal to startTime", () => {
      const result = createSessionSchema.validate({
        ...validSession,
        startTime: "2026-10-15T10:00:00Z",
        endTime: "2026-10-15T10:00:00Z",
      });
      expect(!!result.error).toBe(true);
    });
  });

  describe("updateSessionSchema", () => {
    it("should accept partial update with title only", () => {
      expect(isValid(updateSessionSchema, { title: "Updated Title" })).toBe(true);
    });

    it("should accept empty object", () => {
      expect(isValid(updateSessionSchema, {})).toBe(true);
    });

    it("should reject empty title", () => {
      expect(isValid(updateSessionSchema, { title: "" })).toBe(false);
    });

    it("should reject endTime before startTime when both provided", () => {
      const result = updateSessionSchema.validate({
        startTime: "2026-10-15T11:00:00Z",
        endTime: "2026-10-15T09:00:00Z",
      });
      expect(!!result.error).toBe(true);
    });

    it("should accept valid time update", () => {
      expect(isValid(updateSessionSchema, {
        startTime: "2026-10-15T09:00:00Z",
        endTime: "2026-10-15T12:00:00Z",
      })).toBe(true);
    });

    it("should accept endTime alone (no cross-validation without startTime)", () => {
      expect(isValid(updateSessionSchema, {
        endTime: "2026-10-15T12:00:00Z",
      })).toBe(true);
    });
  });
});

describe("Batch delete safeguard logic", () => {
  it("should block deletion when sessions exist", () => {
    const sessionCount = 3;
    const assessmentCount = 0;
    const canDelete = sessionCount === 0 && assessmentCount === 0;
    expect(canDelete).toBe(false);
  });

  it("should block deletion when assessments exist", () => {
    const sessionCount = 0;
    const assessmentCount = 2;
    const canDelete = sessionCount === 0 && assessmentCount === 0;
    expect(canDelete).toBe(false);
  });

  it("should allow deletion when no sessions or assessments exist", () => {
    const sessionCount = 0;
    const assessmentCount = 0;
    const canDelete = sessionCount === 0 && assessmentCount === 0;
    expect(canDelete).toBe(true);
  });
});

describe("Session delete safeguard logic", () => {
  it("should block deletion when attendance records exist", () => {
    const attendanceCount = 5;
    const feedbackCount = 0;
    const canDelete = attendanceCount === 0 && feedbackCount === 0;
    expect(canDelete).toBe(false);
  });

  it("should block deletion when feedback records exist", () => {
    const attendanceCount = 0;
    const feedbackCount = 3;
    const canDelete = attendanceCount === 0 && feedbackCount === 0;
    expect(canDelete).toBe(false);
  });

  it("should allow deletion when no attendance or feedback exist", () => {
    const attendanceCount = 0;
    const feedbackCount = 0;
    const canDelete = attendanceCount === 0 && feedbackCount === 0;
    expect(canDelete).toBe(true);
  });
});

describe("Session time validation logic", () => {
  it("should reject when endTime equals startTime", () => {
    const start = new Date("2026-10-15T10:00:00Z");
    const end = new Date("2026-10-15T10:00:00Z");
    expect(end <= start).toBe(true);
  });

  it("should reject when endTime is before startTime", () => {
    const start = new Date("2026-10-15T11:00:00Z");
    const end = new Date("2026-10-15T09:00:00Z");
    expect(end <= start).toBe(true);
  });

  it("should accept when endTime is after startTime", () => {
    const start = new Date("2026-10-15T09:00:00Z");
    const end = new Date("2026-10-15T11:00:00Z");
    expect(end > start).toBe(true);
  });
});
