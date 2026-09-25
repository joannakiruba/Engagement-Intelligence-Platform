import {
  createAssessmentSchema,
  updateAssessmentSchema,
  addSectionSchema,
  addQuestionSchema,
  submitScoresSchema,
} from "../validators/assessments.validator";

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

function getErrors(schema: any, data: any): string {
  const { error } = schema.validate(data, { abortEarly: false });
  return error ? error.details.map((d: any) => d.message).join(" ") : "";
}

describe("Assessment Validators", () => {
  describe("createAssessmentSchema", () => {
    const validBase = {
      batchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Midterm Exam",
      type: "QUIZ",
      assessmentDate: "2026-10-01",
    };

    it("should accept valid assessment without sections", () => {
      expect(isValid(createAssessmentSchema, { ...validBase, maxScore: 100 })).toBe(true);
    });

    it("should accept valid assessment with sections and questions", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [
          {
            title: "Aptitude",
            weightage: 40,
            questions: [
              { label: "Q1", maxScore: 10 },
              { label: "Q2", maxScore: 15 },
            ],
          },
          {
            title: "Technical",
            weightage: 60,
            questions: [{ label: "Q1", maxScore: 25 }],
          },
        ],
      })).toBe(true);
    });

    it("should reject empty title", () => {
      expect(isValid(createAssessmentSchema, { ...validBase, title: "" })).toBe(false);
    });

    it("should reject invalid batchId", () => {
      expect(isValid(createAssessmentSchema, { ...validBase, batchId: "not-a-uuid" })).toBe(false);
    });

    it("should reject invalid type", () => {
      expect(isValid(createAssessmentSchema, { ...validBase, type: "INVALID_TYPE" })).toBe(false);
    });

    it("should reject invalid date", () => {
      expect(isValid(createAssessmentSchema, { ...validBase, assessmentDate: "not-a-date" })).toBe(false);
    });

    it("should reject partial weightage (some sections have it, some don't)", () => {
      const result = createAssessmentSchema.validate({
        ...validBase,
        sections: [
          { title: "Section A", weightage: 50, questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "Section B", questions: [{ label: "Q1", maxScore: 10 }] },
        ],
      });
      expect(!!result.error).toBe(true);
      expect(result.error!.details.map((d: any) => d.message).join(" ")).toContain("weightage");
    });

    it("should reject weightages that don't total 100%", () => {
      const result = createAssessmentSchema.validate({
        ...validBase,
        sections: [
          { title: "Section A", weightage: 50, questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "Section B", weightage: 30, questions: [{ label: "Q1", maxScore: 10 }] },
        ],
      });
      expect(!!result.error).toBe(true);
      expect(result.error!.details.map((d: any) => d.message).join(" ")).toContain("100%");
    });

    it("should accept weightages totaling exactly 100%", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [
          { title: "Section A", weightage: 60, questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "Section B", weightage: 40, questions: [{ label: "Q1", maxScore: 15 }] },
        ],
      })).toBe(true);
    });

    it("should accept sections without weightage (all omitted)", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [
          { title: "Section A", questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "Section B", questions: [{ label: "Q1", maxScore: 20 }] },
        ],
      })).toBe(true);
    });

    it("should reject section with no questions", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [{ title: "Section A", questions: [] }],
      })).toBe(false);
    });

    it("should reject question with zero maxScore", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [{ title: "Section A", questions: [{ label: "Q1", maxScore: 0 }] }],
      })).toBe(false);
    });

    it("should reject question with negative maxScore", () => {
      expect(isValid(createAssessmentSchema, {
        ...validBase,
        sections: [{ title: "Section A", questions: [{ label: "Q1", maxScore: -5 }] }],
      })).toBe(false);
    });

    it("should accept all four assessment types", () => {
      for (const type of ["CODING_TEST", "QUIZ", "ASSIGNMENT", "CONTEST"]) {
        expect(isValid(createAssessmentSchema, { ...validBase, type })).toBe(true);
      }
    });
  });

  describe("updateAssessmentSchema", () => {
    it("should accept partial update with title only", () => {
      expect(isValid(updateAssessmentSchema, { title: "Updated Title" })).toBe(true);
    });

    it("should accept empty object (no fields updated)", () => {
      expect(isValid(updateAssessmentSchema, {})).toBe(true);
    });

    it("should reject empty title string", () => {
      expect(isValid(updateAssessmentSchema, { title: "" })).toBe(false);
    });
  });

  describe("addSectionSchema", () => {
    it("should accept valid section", () => {
      expect(isValid(addSectionSchema, { title: "New Section" })).toBe(true);
    });

    it("should accept section with weightage", () => {
      expect(isValid(addSectionSchema, { title: "New Section", weightage: 50, sortOrder: 1 })).toBe(true);
    });

    it("should reject empty title", () => {
      expect(isValid(addSectionSchema, { title: "" })).toBe(false);
    });

    it("should reject weightage over 100", () => {
      expect(isValid(addSectionSchema, { title: "Section", weightage: 150 })).toBe(false);
    });
  });

  describe("addQuestionSchema", () => {
    it("should accept valid question", () => {
      expect(isValid(addQuestionSchema, { label: "Q1", maxScore: 10 })).toBe(true);
    });

    it("should reject missing label", () => {
      expect(isValid(addQuestionSchema, { maxScore: 10 })).toBe(false);
    });

    it("should reject zero maxScore", () => {
      expect(isValid(addQuestionSchema, { label: "Q1", maxScore: 0 })).toBe(false);
    });
  });

  describe("submitScoresSchema", () => {
    it("should accept valid score submission", () => {
      expect(isValid(submitScoresSchema, {
        studentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [
          { questionId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 8 },
        ],
      })).toBe(true);
    });

    it("should reject negative score", () => {
      expect(isValid(submitScoresSchema, {
        studentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [
          { questionId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: -5 },
        ],
      })).toBe(false);
    });

    it("should reject invalid studentId", () => {
      expect(isValid(submitScoresSchema, {
        studentId: "not-uuid",
        questionScores: [
          { questionId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 10 },
        ],
      })).toBe(false);
    });

    it("should reject empty questionScores array", () => {
      expect(isValid(submitScoresSchema, {
        studentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [],
      })).toBe(false);
    });

    it("should accept optional remarks", () => {
      expect(isValid(submitScoresSchema, {
        studentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [
          { questionId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 10 },
        ],
        remarks: "Good performance",
      })).toBe(true);
    });
  });
});

describe("maxScore auto-calculation logic", () => {
  it("should calculate maxScore as sum of all question maxScores", () => {
    const sections = [
      { questions: [{ maxScore: 10 }, { maxScore: 15 }] },
      { questions: [{ maxScore: 25 }, { maxScore: 20 }] },
    ];
    const totalMax = sections.reduce(
      (sum, s) => sum + s.questions.reduce((qs, q) => qs + q.maxScore, 0),
      0
    );
    expect(totalMax).toBe(70);
  });

  it("should be 0 when no sections exist", () => {
    const sections: { questions: { maxScore: number }[] }[] = [];
    const totalMax = sections.reduce(
      (sum, s) => sum + s.questions.reduce((qs, q) => qs + q.maxScore, 0),
      0
    );
    expect(totalMax).toBe(0);
  });
});

describe("Score calculation logic", () => {
  function calculateOverall(
    sections: {
      weightage: number | null;
      questions: { maxScore: number; score: number }[];
    }[]
  ) {
    const hasWeightage = sections.every((s) => s.weightage !== null);

    if (hasWeightage) {
      let weightedTotal = 0;
      for (const section of sections) {
        const sectionMax = section.questions.reduce((sum, q) => sum + q.maxScore, 0);
        const sectionScore = section.questions.reduce((sum, q) => sum + q.score, 0);
        if (sectionMax > 0) {
          weightedTotal += (sectionScore / sectionMax) * (section.weightage as number);
        }
      }
      return Math.round(weightedTotal * 100) / 100;
    }

    return sections.reduce(
      (sum, s) => sum + s.questions.reduce((qs, q) => qs + q.score, 0),
      0
    );
  }

  it("should calculate raw total when no weightage", () => {
    const sections = [
      {
        weightage: null,
        questions: [
          { maxScore: 10, score: 8 },
          { maxScore: 20, score: 15 },
        ],
      },
      {
        weightage: null,
        questions: [{ maxScore: 30, score: 25 }],
      },
    ];
    expect(calculateOverall(sections)).toBe(48);
  });

  it("should calculate weighted score out of 100 when weightage is set", () => {
    const sections = [
      {
        weightage: 40,
        questions: [
          { maxScore: 10, score: 10 },
          { maxScore: 10, score: 10 },
        ],
      },
      {
        weightage: 60,
        questions: [
          { maxScore: 50, score: 25 },
        ],
      },
    ];
    expect(calculateOverall(sections)).toBe(70);
  });

  it("should handle partial scores with weightage", () => {
    const sections = [
      {
        weightage: 30,
        questions: [{ maxScore: 100, score: 50 }],
      },
      {
        weightage: 70,
        questions: [{ maxScore: 100, score: 80 }],
      },
    ];
    expect(calculateOverall(sections)).toBe(71);
  });

  it("should return 0 for empty sections", () => {
    expect(calculateOverall([])).toBe(0);
  });

  it("should handle zero maxScore section gracefully", () => {
    const sections = [
      {
        weightage: 100,
        questions: [] as { maxScore: number; score: number }[],
      },
    ];
    expect(calculateOverall(sections)).toBe(0);
  });
});

describe("CSV parsing validation", () => {
  it("should identify required headers (case-insensitive)", () => {
    const headers = ["StudentID", "QuestionID", "Score"];
    const normalized = headers.map((h) => h.toLowerCase());
    const required = ["studentid", "questionid", "score"];
    const missing = required.filter((h) => !normalized.includes(h));
    expect(missing).toHaveLength(0);
  });

  it("should detect missing headers", () => {
    const headers = ["StudentID", "Score"];
    const normalized = headers.map((h) => h.toLowerCase());
    const required = ["studentid", "questionid", "score"];
    const missing = required.filter((h) => !normalized.includes(h));
    expect(missing).toContain("questionid");
  });

  it("should handle case-insensitive header matching", () => {
    const headers = ["STUDENTID", "questionId", "SCORE"];
    const normalized = headers.map((h) => h.toLowerCase());
    const required = ["studentid", "questionid", "score"];
    const missing = required.filter((h) => !normalized.includes(h));
    expect(missing).toHaveLength(0);
  });
});

describe("Weightage validation", () => {
  it("should detect when not all sections have weightage", () => {
    const sections = [
      { weightage: 50 },
      { weightage: undefined },
    ];
    const hasWeightage = sections.some((s) => s.weightage !== undefined);
    const allHaveWeightage = sections.every((s) => s.weightage !== undefined);
    expect(hasWeightage).toBe(true);
    expect(allHaveWeightage).toBe(false);
  });

  it("should validate weightage sum equals 100", () => {
    const sections = [
      { weightage: 40 },
      { weightage: 60 },
    ];
    const total = sections.reduce((sum, s) => sum + (s.weightage ?? 0), 0);
    expect(Math.abs(total - 100) < 0.01).toBe(true);
  });

  it("should reject weightage sum not equal to 100", () => {
    const sections = [
      { weightage: 40 },
      { weightage: 40 },
    ];
    const total = sections.reduce((sum, s) => sum + (s.weightage ?? 0), 0);
    expect(Math.abs(total - 100) < 0.01).toBe(false);
  });
});
