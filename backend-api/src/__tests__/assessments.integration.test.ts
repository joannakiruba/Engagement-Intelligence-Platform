import express from "express";
import request from "supertest";

class ServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

const mockFns = {
  createAssessment: jest.fn(),
  listAssessments: jest.fn(),
  getAssessmentById: jest.fn(),
  updateAssessment: jest.fn(),
  deleteAssessment: jest.fn(),
  addSection: jest.fn(),
  updateSection: jest.fn(),
  deleteSection: jest.fn(),
  addQuestion: jest.fn(),
  updateQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  submitQuestionScores: jest.fn(),
  getResults: jest.fn(),
  getStudentResult: jest.fn(),
  bulkUploadScores: jest.fn(),
};

jest.mock("../services/assessments.service", () => {
  class SE extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "ServiceError";
      this.statusCode = statusCode;
    }
  }
  return {
    __esModule: true,
    ServiceError: SE,
    createAssessment: (...args: any[]) => mockFns.createAssessment(...args),
    listAssessments: (...args: any[]) => mockFns.listAssessments(...args),
    getAssessmentById: (...args: any[]) => mockFns.getAssessmentById(...args),
    updateAssessment: (...args: any[]) => mockFns.updateAssessment(...args),
    deleteAssessment: (...args: any[]) => mockFns.deleteAssessment(...args),
    addSection: (...args: any[]) => mockFns.addSection(...args),
    updateSection: (...args: any[]) => mockFns.updateSection(...args),
    deleteSection: (...args: any[]) => mockFns.deleteSection(...args),
    addQuestion: (...args: any[]) => mockFns.addQuestion(...args),
    updateQuestion: (...args: any[]) => mockFns.updateQuestion(...args),
    deleteQuestion: (...args: any[]) => mockFns.deleteQuestion(...args),
    submitQuestionScores: (...args: any[]) => mockFns.submitQuestionScores(...args),
    getResults: (...args: any[]) => mockFns.getResults(...args),
    getStudentResult: (...args: any[]) => mockFns.getStudentResult(...args),
    bulkUploadScores: (...args: any[]) => mockFns.bulkUploadScores(...args),
  };
});

import assessmentRoutes from "../routes/assessments.routes";
import { errorHandler } from "../middleware/error.middleware";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/assessments", assessmentRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
});

// ===========================================
// 1. CREATE ASSESSMENT
// ===========================================
describe("POST /api/assessments", () => {
  const validPayload = {
    batchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "Midterm Exam",
    type: "QUIZ",
    assessmentDate: "2026-10-01T10:00:00Z",
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
  };

  it("should return 201 on valid create", async () => {
    mockFns.createAssessment.mockResolvedValue({ id: "new-id", ...validPayload });
    const res = await request(app).post("/api/assessments").send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockFns.createAssessment).toHaveBeenCalledTimes(1);
  });

  it("should return 400 on missing title", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .send({ ...validPayload, title: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 on invalid type", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .send({ ...validPayload, type: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("should return 400 on partial weightage", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .send({
        ...validPayload,
        sections: [
          { title: "A", weightage: 50, questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "B", questions: [{ label: "Q1", maxScore: 10 }] },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("should return 400 when weightages don't total 100", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .send({
        ...validPayload,
        sections: [
          { title: "A", weightage: 40, questions: [{ label: "Q1", maxScore: 10 }] },
          { title: "B", weightage: 40, questions: [{ label: "Q1", maxScore: 10 }] },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("should return 404 when batch not found", async () => {
    mockFns.createAssessment.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).post("/api/assessments").send(validPayload);
    expect(res.status).toBe(404);
  });

  it("should accept create without sections", async () => {
    const noSections = {
      batchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Simple Quiz",
      type: "QUIZ",
      assessmentDate: "2026-10-01T10:00:00Z",
      maxScore: 100,
    };
    mockFns.createAssessment.mockResolvedValue({ id: "id", ...noSections });
    const res = await request(app).post("/api/assessments").send(noSections);
    expect(res.status).toBe(201);
  });
});

// ===========================================
// 2. LIST ASSESSMENTS
// ===========================================
describe("GET /api/assessments", () => {
  it("should return 200 with list", async () => {
    mockFns.listAssessments.mockResolvedValue([{ id: "1", title: "Test" }]);
    const res = await request(app).get("/api/assessments");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should pass query filters to service", async () => {
    mockFns.listAssessments.mockResolvedValue([]);
    await request(app).get("/api/assessments?batchId=abc&type=QUIZ");
    expect(mockFns.listAssessments).toHaveBeenCalledWith({ batchId: "abc", type: "QUIZ" });
  });
});

// ===========================================
// 3. GET ASSESSMENT
// ===========================================
describe("GET /api/assessments/:id", () => {
  it("should return 200 with assessment", async () => {
    mockFns.getAssessmentById.mockResolvedValue({ id: "1", title: "Test" });
    const res = await request(app).get("/api/assessments/1");
    expect(res.status).toBe(200);
  });

  it("should return 404 when not found", async () => {
    mockFns.getAssessmentById.mockRejectedValue(new ServiceError("Assessment not found", 404));
    const res = await request(app).get("/api/assessments/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 4. UPDATE ASSESSMENT
// ===========================================
describe("PUT /api/assessments/:id", () => {
  it("should return 200 on valid update", async () => {
    mockFns.updateAssessment.mockResolvedValue({ id: "1", title: "Updated" });
    const res = await request(app)
      .put("/api/assessments/1")
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
  });

  it("should return 400 on empty title", async () => {
    const res = await request(app)
      .put("/api/assessments/1")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("should return 404 when not found", async () => {
    mockFns.updateAssessment.mockRejectedValue(new ServiceError("Assessment not found", 404));
    const res = await request(app)
      .put("/api/assessments/1")
      .send({ title: "X" });
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 5. DELETE ASSESSMENT
// ===========================================
describe("DELETE /api/assessments/:id", () => {
  it("should return 200 on successful delete", async () => {
    mockFns.deleteAssessment.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/assessments/1");
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("deleted");
  });

  it("should return 404 when not found", async () => {
    mockFns.deleteAssessment.mockRejectedValue(new ServiceError("Assessment not found", 404));
    const res = await request(app).delete("/api/assessments/999");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 6. SECTION CRUD
// ===========================================
describe("POST /api/assessments/:id/sections", () => {
  it("should return 201 on valid section add", async () => {
    mockFns.addSection.mockResolvedValue({ id: "s1", title: "New Section" });
    const res = await request(app)
      .post("/api/assessments/1/sections")
      .send({ title: "New Section" });
    expect(res.status).toBe(201);
  });

  it("should return 400 on empty title", async () => {
    const res = await request(app)
      .post("/api/assessments/1/sections")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("should return 409 when scores exist (structural protection)", async () => {
    mockFns.addSection.mockRejectedValue(
      new ServiceError("Cannot modify structure: student scores already exist", 409)
    );
    const res = await request(app)
      .post("/api/assessments/1/sections")
      .send({ title: "New" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/assessments/:id/sections/:sectionId", () => {
  it("should return 200 on valid update", async () => {
    mockFns.updateSection.mockResolvedValue({ id: "s1", title: "Updated" });
    const res = await request(app)
      .put("/api/assessments/1/sections/s1")
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
  });

  it("should return 409 when scores exist", async () => {
    mockFns.updateSection.mockRejectedValue(
      new ServiceError("Cannot modify section: student scores already exist", 409)
    );
    const res = await request(app)
      .put("/api/assessments/1/sections/s1")
      .send({ title: "X" });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/assessments/:id/sections/:sectionId", () => {
  it("should return 200 on successful delete", async () => {
    mockFns.deleteSection.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/assessments/1/sections/s1");
    expect(res.status).toBe(200);
  });

  it("should return 409 when scores exist", async () => {
    mockFns.deleteSection.mockRejectedValue(
      new ServiceError("Cannot delete section: student scores already exist", 409)
    );
    const res = await request(app).delete("/api/assessments/1/sections/s1");
    expect(res.status).toBe(409);
  });
});

// ===========================================
// 7. QUESTION CRUD
// ===========================================
describe("POST /api/assessments/:id/sections/:sectionId/questions", () => {
  it("should return 201 on valid question add", async () => {
    mockFns.addQuestion.mockResolvedValue({ id: "q1", label: "Q1", maxScore: 10 });
    const res = await request(app)
      .post("/api/assessments/1/sections/s1/questions")
      .send({ label: "Q1", maxScore: 10 });
    expect(res.status).toBe(201);
  });

  it("should return 400 on missing maxScore", async () => {
    const res = await request(app)
      .post("/api/assessments/1/sections/s1/questions")
      .send({ label: "Q1" });
    expect(res.status).toBe(400);
  });

  it("should return 400 on zero maxScore", async () => {
    const res = await request(app)
      .post("/api/assessments/1/sections/s1/questions")
      .send({ label: "Q1", maxScore: 0 });
    expect(res.status).toBe(400);
  });

  it("should return 409 when scores exist", async () => {
    mockFns.addQuestion.mockRejectedValue(
      new ServiceError("Cannot modify structure: student scores already exist", 409)
    );
    const res = await request(app)
      .post("/api/assessments/1/sections/s1/questions")
      .send({ label: "Q1", maxScore: 10 });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/assessments/:id/questions/:questionId", () => {
  it("should return 200 on valid update", async () => {
    mockFns.updateQuestion.mockResolvedValue({ id: "q1", label: "Updated" });
    const res = await request(app)
      .put("/api/assessments/1/questions/q1")
      .send({ label: "Updated" });
    expect(res.status).toBe(200);
  });

  it("should return 409 when scores exist", async () => {
    mockFns.updateQuestion.mockRejectedValue(
      new ServiceError("Cannot modify question: student scores already exist", 409)
    );
    const res = await request(app)
      .put("/api/assessments/1/questions/q1")
      .send({ maxScore: 20 });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/assessments/:id/questions/:questionId", () => {
  it("should return 200 on successful delete", async () => {
    mockFns.deleteQuestion.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/assessments/1/questions/q1");
    expect(res.status).toBe(200);
  });
});

// ===========================================
// 8. SUBMIT QUESTION SCORES
// ===========================================
describe("POST /api/assessments/:id/scores", () => {
  const validScores = {
    studentId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    questionScores: [
      { questionId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 8 },
    ],
  };

  it("should return 201 on valid submission", async () => {
    mockFns.submitQuestionScores.mockResolvedValue({
      questionScores: [],
      result: { score: 8 },
    });
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send(validScores);
    expect(res.status).toBe(201);
  });

  it("should return 400 on negative score", async () => {
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send({
        studentId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [{ questionId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: -5 }],
      });
    expect(res.status).toBe(400);
  });

  it("should return 400 on empty questionScores", async () => {
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send({
        studentId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        questionScores: [],
      });
    expect(res.status).toBe(400);
  });

  it("should return 400 on invalid studentId", async () => {
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send({
        studentId: "not-uuid",
        questionScores: [{ questionId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 5 }],
      });
    expect(res.status).toBe(400);
  });

  it("should return 400 when student not in batch", async () => {
    mockFns.submitQuestionScores.mockRejectedValue(
      new ServiceError("Student does not belong to the assessment's batch", 400)
    );
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send(validScores);
    expect(res.status).toBe(400);
  });

  it("should return 400 when score exceeds maxScore", async () => {
    mockFns.submitQuestionScores.mockRejectedValue(
      new ServiceError("Score 100 exceeds maxScore 10", 400)
    );
    const res = await request(app)
      .post("/api/assessments/1/scores")
      .send(validScores);
    expect(res.status).toBe(400);
  });
});

// ===========================================
// 9. GET RESULTS
// ===========================================
describe("GET /api/assessments/:id/results", () => {
  it("should return 200 with results", async () => {
    mockFns.getResults.mockResolvedValue({
      assessment: { id: "1", title: "Test" },
      results: [],
    });
    const res = await request(app).get("/api/assessments/1/results");
    expect(res.status).toBe(200);
    expect(res.body.data.results).toBeDefined();
  });

  it("should return 404 when assessment not found", async () => {
    mockFns.getResults.mockRejectedValue(new ServiceError("Assessment not found", 404));
    const res = await request(app).get("/api/assessments/999/results");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 10. GET STUDENT RESULT
// ===========================================
describe("GET /api/assessments/:id/results/:studentId", () => {
  it("should return 200 with student result", async () => {
    mockFns.getStudentResult.mockResolvedValue({
      studentId: "s1",
      overallScore: 85,
      sections: [],
    });
    const res = await request(app).get("/api/assessments/1/results/s1");
    expect(res.status).toBe(200);
    expect(res.body.data.overallScore).toBe(85);
  });

  it("should return 404 when no result for student", async () => {
    mockFns.getStudentResult.mockRejectedValue(
      new ServiceError("No result found for this student", 404)
    );
    const res = await request(app).get("/api/assessments/1/results/unknown");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 11. BULK CSV UPLOAD
// ===========================================
describe("POST /api/assessments/:id/scores/bulk", () => {
  it("should return 200 when all rows succeed", async () => {
    mockFns.bulkUploadScores.mockResolvedValue({
      total: 2, created: 2, updated: 0, errors: 0,
      details: [{ row: 2, status: "created" }, { row: 3, status: "created" }],
    });
    const csv = "studentId,questionId,score\nstu1,q1,10\nstu1,q2,20";
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(csv), "scores.csv");
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
  });

  it("should return 207 on partial success", async () => {
    mockFns.bulkUploadScores.mockResolvedValue({
      total: 2, created: 1, updated: 0, errors: 1,
      details: [
        { row: 2, status: "created" },
        { row: 3, status: "error", error: "Student not in batch" },
      ],
    });
    const csv = "studentId,questionId,score\nstu1,q1,10\nstu2,q1,999";
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(csv), "scores.csv");
    expect(res.status).toBe(207);
  });

  it("should return 400 when no file uploaded", async () => {
    const res = await request(app).post("/api/assessments/1/scores/bulk");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No file");
  });

  it("should return 400 on empty file", async () => {
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(""), "empty.csv");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("empty");
  });

  it("should return 400 on missing required columns", async () => {
    const csv = "studentId,score\nstu1,10";
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(csv), "scores.csv");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("questionid");
  });

  it("should handle case-insensitive headers", async () => {
    mockFns.bulkUploadScores.mockResolvedValue({
      total: 1, created: 1, updated: 0, errors: 0, details: [],
    });
    const csv = "STUDENTID,QuestionID,SCORE\nstu1,q1,10";
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(csv), "scores.csv");
    expect(res.status).toBe(200);
    expect(mockFns.bulkUploadScores).toHaveBeenCalledWith("1", [
      { studentId: "stu1", questionId: "q1", score: "10" },
    ]);
  });

  it("should handle quoted fields in CSV", async () => {
    mockFns.bulkUploadScores.mockResolvedValue({
      total: 1, created: 1, updated: 0, errors: 0, details: [],
    });
    const csv = '"studentId","questionId","score"\n"stu1","q1","10"';
    const res = await request(app)
      .post("/api/assessments/1/scores/bulk")
      .attach("file", Buffer.from(csv), "scores.csv");
    expect(res.status).toBe(200);
    expect(mockFns.bulkUploadScores).toHaveBeenCalledWith("1", [
      { studentId: "stu1", questionId: "q1", score: "10" },
    ]);
  });
});

// ===========================================
// 12. SERVICE CALL VERIFICATION
// ===========================================
describe("Service call verification", () => {
  it("create passes full nested payload to service", async () => {
    const payload = {
      batchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Test",
      type: "QUIZ",
      assessmentDate: "2026-10-01T10:00:00Z",
      sections: [
        { title: "Section A", questions: [{ label: "Q1", maxScore: 10 }] },
      ],
    };
    mockFns.createAssessment.mockResolvedValue({ id: "1" });
    await request(app).post("/api/assessments").send(payload);
    const call = mockFns.createAssessment.mock.calls[0][0];
    expect(call.sections).toHaveLength(1);
    expect(call.sections[0].questions).toHaveLength(1);
    expect(call.sections[0].questions[0].maxScore).toBe(10);
  });

  it("submit scores passes studentId and questionScores to service", async () => {
    const payload = {
      studentId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      questionScores: [
        { questionId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", score: 8 },
      ],
      remarks: "Good work",
    };
    mockFns.submitQuestionScores.mockResolvedValue({ questionScores: [], result: {} });
    await request(app).post("/api/assessments/a1/scores").send(payload);
    expect(mockFns.submitQuestionScores).toHaveBeenCalledWith("a1", payload);
  });

  it("update passes only flat fields, no sections", async () => {
    mockFns.updateAssessment.mockResolvedValue({});
    await request(app)
      .put("/api/assessments/a1")
      .send({ title: "New Title", type: "CONTEST" });
    const call = mockFns.updateAssessment.mock.calls[0];
    expect(call[0]).toBe("a1");
    expect(call[1].title).toBe("New Title");
    expect(call[1].type).toBe("CONTEST");
    expect(call[1].sections).toBeUndefined();
  });

  it("delete calls deleteAssessment with correct id", async () => {
    mockFns.deleteAssessment.mockResolvedValue(undefined);
    await request(app).delete("/api/assessments/abc123");
    expect(mockFns.deleteAssessment).toHaveBeenCalledWith("abc123");
  });

  it("addSection passes assessmentId and body to service", async () => {
    mockFns.addSection.mockResolvedValue({ id: "s1" });
    await request(app)
      .post("/api/assessments/a1/sections")
      .send({ title: "New", weightage: 50 });
    expect(mockFns.addSection).toHaveBeenCalledWith("a1", { title: "New", weightage: 50 });
  });

  it("addQuestion passes assessmentId, sectionId, and body to service", async () => {
    mockFns.addQuestion.mockResolvedValue({ id: "q1" });
    await request(app)
      .post("/api/assessments/a1/sections/s1/questions")
      .send({ label: "Q1", maxScore: 10 });
    expect(mockFns.addQuestion).toHaveBeenCalledWith("a1", "s1", { label: "Q1", maxScore: 10 });
  });

  it("getResults passes assessmentId to service", async () => {
    mockFns.getResults.mockResolvedValue({ assessment: {}, results: [] });
    await request(app).get("/api/assessments/a1/results");
    expect(mockFns.getResults).toHaveBeenCalledWith("a1");
  });

  it("getStudentResult passes both ids to service", async () => {
    mockFns.getStudentResult.mockResolvedValue({ studentId: "s1" });
    await request(app).get("/api/assessments/a1/results/s1");
    expect(mockFns.getStudentResult).toHaveBeenCalledWith("a1", "s1");
  });
});
