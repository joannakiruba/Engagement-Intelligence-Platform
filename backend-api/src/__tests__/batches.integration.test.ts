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
  createBatch: jest.fn(),
  listBatches: jest.fn(),
  getBatchById: jest.fn(),
  updateBatch: jest.fn(),
  deleteBatch: jest.fn(),
  getRoster: jest.fn(),
  addStudent: jest.fn(),
  removeStudent: jest.fn(),
  getTrainers: jest.fn(),
  assignTrainer: jest.fn(),
  removeTrainer: jest.fn(),
  listSessions: jest.fn(),
  createSession: jest.fn(),
  getSessionById: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
};

jest.mock("../services/batches.service", () => {
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
    createBatch: (...args: any[]) => mockFns.createBatch(...args),
    listBatches: (...args: any[]) => mockFns.listBatches(...args),
    getBatchById: (...args: any[]) => mockFns.getBatchById(...args),
    updateBatch: (...args: any[]) => mockFns.updateBatch(...args),
    deleteBatch: (...args: any[]) => mockFns.deleteBatch(...args),
    getRoster: (...args: any[]) => mockFns.getRoster(...args),
    addStudent: (...args: any[]) => mockFns.addStudent(...args),
    removeStudent: (...args: any[]) => mockFns.removeStudent(...args),
    getTrainers: (...args: any[]) => mockFns.getTrainers(...args),
    assignTrainer: (...args: any[]) => mockFns.assignTrainer(...args),
    removeTrainer: (...args: any[]) => mockFns.removeTrainer(...args),
    listSessions: (...args: any[]) => mockFns.listSessions(...args),
    createSession: (...args: any[]) => mockFns.createSession(...args),
    getSessionById: (...args: any[]) => mockFns.getSessionById(...args),
    updateSession: (...args: any[]) => mockFns.updateSession(...args),
    deleteSession: (...args: any[]) => mockFns.deleteSession(...args),
  };
});

import batchRoutes from "../routes/batches.routes";
import sessionRoutes from "../routes/sessions.routes";
import { errorHandler } from "../middleware/error.middleware";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/batches", batchRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
});

// ===========================================
// 1. CREATE BATCH
// ===========================================
describe("POST /api/batches", () => {
  const validPayload = {
    name: "CS Batch 2026",
    startDate: "2026-10-01",
    department: "Computer Science",
  };

  it("should return 201 on valid create", async () => {
    mockFns.createBatch.mockResolvedValue({ id: "b1", ...validPayload });
    const res = await request(app).post("/api/batches").send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockFns.createBatch).toHaveBeenCalledTimes(1);
  });

  it("should return 400 on missing name", async () => {
    const res = await request(app)
      .post("/api/batches")
      .send({ startDate: "2026-10-01" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 on empty name", async () => {
    const res = await request(app)
      .post("/api/batches")
      .send({ ...validPayload, name: "" });
    expect(res.status).toBe(400);
  });

  it("should return 400 on invalid startDate", async () => {
    const res = await request(app)
      .post("/api/batches")
      .send({ ...validPayload, startDate: "bad-date" });
    expect(res.status).toBe(400);
  });

  it("should accept create with all optional fields", async () => {
    const full = {
      ...validPayload,
      endDate: "2027-03-31",
      description: "Fall semester batch",
    };
    mockFns.createBatch.mockResolvedValue({ id: "b1", ...full });
    const res = await request(app).post("/api/batches").send(full);
    expect(res.status).toBe(201);
  });
});

// ===========================================
// 2. LIST BATCHES
// ===========================================
describe("GET /api/batches", () => {
  it("should return 200 with list", async () => {
    mockFns.listBatches.mockResolvedValue([
      { id: "b1", name: "Batch A", memberCount: 5 },
    ]);
    const res = await request(app).get("/api/batches");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return empty array when no batches", async () => {
    mockFns.listBatches.mockResolvedValue([]);
    const res = await request(app).get("/api/batches");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ===========================================
// 3. GET BATCH
// ===========================================
describe("GET /api/batches/:id", () => {
  it("should return 200 with batch", async () => {
    mockFns.getBatchById.mockResolvedValue({ id: "b1", name: "Batch A" });
    const res = await request(app).get("/api/batches/b1");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Batch A");
  });

  it("should return 404 when not found", async () => {
    mockFns.getBatchById.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).get("/api/batches/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 4. UPDATE BATCH
// ===========================================
describe("PUT /api/batches/:id", () => {
  it("should return 200 on valid update", async () => {
    mockFns.updateBatch.mockResolvedValue({ id: "b1", name: "Updated" });
    const res = await request(app)
      .put("/api/batches/b1")
      .send({ name: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 on empty name", async () => {
    const res = await request(app)
      .put("/api/batches/b1")
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("should return 404 when not found", async () => {
    mockFns.updateBatch.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app)
      .put("/api/batches/b1")
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 5. DELETE BATCH
// ===========================================
describe("DELETE /api/batches/:id", () => {
  it("should return 200 on successful delete", async () => {
    mockFns.deleteBatch.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/batches/b1");
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("deleted");
  });

  it("should return 404 when not found", async () => {
    mockFns.deleteBatch.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).delete("/api/batches/nonexistent");
    expect(res.status).toBe(404);
  });

  it("should return 409 when batch has sessions", async () => {
    mockFns.deleteBatch.mockRejectedValue(
      new ServiceError("Cannot delete batch: it has associated sessions. Remove all sessions first.", 409)
    );
    const res = await request(app).delete("/api/batches/b1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("sessions");
  });

  it("should return 409 when batch has assessments", async () => {
    mockFns.deleteBatch.mockRejectedValue(
      new ServiceError("Cannot delete batch: it has associated assessments. Remove all assessments first.", 409)
    );
    const res = await request(app).delete("/api/batches/b1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("assessments");
  });
});

// ===========================================
// 6. ROSTER (STUDENTS)
// ===========================================
describe("GET /api/batches/:id/roster", () => {
  it("should return 200 with roster", async () => {
    mockFns.getRoster.mockResolvedValue([
      { id: "s1", name: "Alice", email: "alice@test.com" },
    ]);
    const res = await request(app).get("/api/batches/b1/roster");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return 404 when batch not found", async () => {
    mockFns.getRoster.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).get("/api/batches/bad/roster");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/batches/:id/students", () => {
  const validStudent = { studentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" };

  it("should return 201 on valid add", async () => {
    mockFns.addStudent.mockResolvedValue({ id: "s1", name: "Alice" });
    const res = await request(app)
      .post("/api/batches/b1/students")
      .send(validStudent);
    expect(res.status).toBe(201);
  });

  it("should return 400 on invalid studentId", async () => {
    const res = await request(app)
      .post("/api/batches/b1/students")
      .send({ studentId: "not-uuid" });
    expect(res.status).toBe(400);
  });

  it("should return 404 when student not found", async () => {
    mockFns.addStudent.mockRejectedValue(new ServiceError("Student not found", 404));
    const res = await request(app)
      .post("/api/batches/b1/students")
      .send(validStudent);
    expect(res.status).toBe(404);
  });

  it("should return 409 when student already in batch", async () => {
    mockFns.addStudent.mockRejectedValue(
      new ServiceError("Student is already a member of this batch", 409)
    );
    const res = await request(app)
      .post("/api/batches/b1/students")
      .send(validStudent);
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/batches/:id/students/:studentId", () => {
  it("should return 200 on successful removal", async () => {
    mockFns.removeStudent.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/batches/b1/students/s1");
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("removed");
  });

  it("should return 404 when student not in batch", async () => {
    mockFns.removeStudent.mockRejectedValue(
      new ServiceError("Student is not a member of this batch", 404)
    );
    const res = await request(app).delete("/api/batches/b1/students/s1");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 7. TRAINERS
// ===========================================
describe("GET /api/batches/:id/trainers", () => {
  it("should return 200 with trainers", async () => {
    mockFns.getTrainers.mockResolvedValue([
      { id: "t1", name: "Dr. Smith", email: "smith@test.com" },
    ]);
    const res = await request(app).get("/api/batches/b1/trainers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return 404 when batch not found", async () => {
    mockFns.getTrainers.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).get("/api/batches/bad/trainers");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/batches/:id/trainers", () => {
  const validTrainer = { trainerId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" };

  it("should return 201 on valid assign", async () => {
    mockFns.assignTrainer.mockResolvedValue({ id: "t1", name: "Dr. Smith" });
    const res = await request(app)
      .post("/api/batches/b1/trainers")
      .send(validTrainer);
    expect(res.status).toBe(201);
  });

  it("should return 400 on invalid trainerId", async () => {
    const res = await request(app)
      .post("/api/batches/b1/trainers")
      .send({ trainerId: "bad" });
    expect(res.status).toBe(400);
  });

  it("should return 404 when trainer not found", async () => {
    mockFns.assignTrainer.mockRejectedValue(new ServiceError("Trainer not found", 404));
    const res = await request(app)
      .post("/api/batches/b1/trainers")
      .send(validTrainer);
    expect(res.status).toBe(404);
  });

  it("should return 409 when trainer already assigned", async () => {
    mockFns.assignTrainer.mockRejectedValue(
      new ServiceError("Trainer is already assigned to this batch", 409)
    );
    const res = await request(app)
      .post("/api/batches/b1/trainers")
      .send(validTrainer);
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/batches/:id/trainers/:trainerId", () => {
  it("should return 200 on successful removal", async () => {
    mockFns.removeTrainer.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/batches/b1/trainers/t1");
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("removed");
  });

  it("should return 404 when trainer not in batch", async () => {
    mockFns.removeTrainer.mockRejectedValue(
      new ServiceError("Trainer is not assigned to this batch", 404)
    );
    const res = await request(app).delete("/api/batches/b1/trainers/t1");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 8. BATCH-SCOPED SESSIONS
// ===========================================
describe("GET /api/batches/:id/sessions", () => {
  it("should return 200 with sessions", async () => {
    mockFns.listSessions.mockResolvedValue([
      { id: "sess1", title: "Intro to Node.js" },
    ]);
    const res = await request(app).get("/api/batches/b1/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return 404 when batch not found", async () => {
    mockFns.listSessions.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app).get("/api/batches/bad/sessions");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/batches/:id/sessions", () => {
  const validSession = {
    trainerId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "Intro to Node.js",
    scheduledDate: "2026-10-15",
    startTime: "2026-10-15T09:00:00Z",
    endTime: "2026-10-15T11:00:00Z",
  };

  it("should return 201 on valid create", async () => {
    mockFns.createSession.mockResolvedValue({ id: "sess1", ...validSession });
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send(validSession);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 on empty title", async () => {
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send({ ...validSession, title: "" });
    expect(res.status).toBe(400);
  });

  it("should return 400 on invalid trainerId", async () => {
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send({ ...validSession, trainerId: "bad" });
    expect(res.status).toBe(400);
  });

  it("should return 400 when endTime before startTime", async () => {
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send({
        ...validSession,
        startTime: "2026-10-15T11:00:00Z",
        endTime: "2026-10-15T09:00:00Z",
      });
    expect(res.status).toBe(400);
  });

  it("should return 404 when batch not found", async () => {
    mockFns.createSession.mockRejectedValue(new ServiceError("Batch not found", 404));
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send(validSession);
    expect(res.status).toBe(404);
  });

  it("should return 404 when trainer not found", async () => {
    mockFns.createSession.mockRejectedValue(new ServiceError("Trainer not found", 404));
    const res = await request(app)
      .post("/api/batches/b1/sessions")
      .send(validSession);
    expect(res.status).toBe(404);
  });
});

// ===========================================
// 9. SESSION ROUTES (individual)
// ===========================================
describe("GET /api/sessions/:id", () => {
  it("should return 200 with session", async () => {
    mockFns.getSessionById.mockResolvedValue({ id: "sess1", title: "Node.js" });
    const res = await request(app).get("/api/sessions/sess1");
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Node.js");
  });

  it("should return 404 when not found", async () => {
    mockFns.getSessionById.mockRejectedValue(new ServiceError("Session not found", 404));
    const res = await request(app).get("/api/sessions/bad");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/sessions/:id", () => {
  it("should return 200 on valid update", async () => {
    mockFns.updateSession.mockResolvedValue({ id: "sess1", title: "Updated" });
    const res = await request(app)
      .put("/api/sessions/sess1")
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 on empty title", async () => {
    const res = await request(app)
      .put("/api/sessions/sess1")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("should return 400 when endTime before startTime", async () => {
    const res = await request(app)
      .put("/api/sessions/sess1")
      .send({
        startTime: "2026-10-15T11:00:00Z",
        endTime: "2026-10-15T09:00:00Z",
      });
    expect(res.status).toBe(400);
  });

  it("should return 404 when not found", async () => {
    mockFns.updateSession.mockRejectedValue(new ServiceError("Session not found", 404));
    const res = await request(app)
      .put("/api/sessions/sess1")
      .send({ title: "X" });
    expect(res.status).toBe(404);
  });

  it("should return 400 when service rejects time conflict", async () => {
    mockFns.updateSession.mockRejectedValue(
      new ServiceError("endTime must be after startTime", 400)
    );
    const res = await request(app)
      .put("/api/sessions/sess1")
      .send({ endTime: "2026-10-15T08:00:00Z" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/sessions/:id", () => {
  it("should return 200 on successful delete", async () => {
    mockFns.deleteSession.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/sessions/sess1");
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("deleted");
  });

  it("should return 404 when not found", async () => {
    mockFns.deleteSession.mockRejectedValue(new ServiceError("Session not found", 404));
    const res = await request(app).delete("/api/sessions/bad");
    expect(res.status).toBe(404);
  });

  it("should return 409 when session has attendance", async () => {
    mockFns.deleteSession.mockRejectedValue(
      new ServiceError("Cannot delete session: it has associated attendance records.", 409)
    );
    const res = await request(app).delete("/api/sessions/sess1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("attendance");
  });

  it("should return 409 when session has feedback", async () => {
    mockFns.deleteSession.mockRejectedValue(
      new ServiceError("Cannot delete session: it has associated feedback records.", 409)
    );
    const res = await request(app).delete("/api/sessions/sess1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("feedback");
  });
});

// ===========================================
// 10. SERVICE CALL VERIFICATION
// ===========================================
describe("Service call verification", () => {
  it("createBatch passes body to service", async () => {
    const payload = { name: "Test", startDate: "2026-10-01" };
    mockFns.createBatch.mockResolvedValue({ id: "b1" });
    await request(app).post("/api/batches").send(payload);
    const call = mockFns.createBatch.mock.calls[0][0];
    expect(call.name).toBe("Test");
    expect(call.startDate).toBeDefined();
  });

  it("updateBatch passes id and body to service", async () => {
    mockFns.updateBatch.mockResolvedValue({});
    await request(app).put("/api/batches/b1").send({ name: "New" });
    expect(mockFns.updateBatch).toHaveBeenCalledWith("b1", { name: "New" });
  });

  it("deleteBatch passes correct id", async () => {
    mockFns.deleteBatch.mockResolvedValue(undefined);
    await request(app).delete("/api/batches/b1");
    expect(mockFns.deleteBatch).toHaveBeenCalledWith("b1");
  });

  it("addStudent passes batchId and studentId", async () => {
    const studentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    mockFns.addStudent.mockResolvedValue({ id: "s1" });
    await request(app)
      .post("/api/batches/b1/students")
      .send({ studentId });
    expect(mockFns.addStudent).toHaveBeenCalledWith("b1", studentId);
  });

  it("removeStudent passes batchId and studentId", async () => {
    mockFns.removeStudent.mockResolvedValue(undefined);
    await request(app).delete("/api/batches/b1/students/s1");
    expect(mockFns.removeStudent).toHaveBeenCalledWith("b1", "s1");
  });

  it("assignTrainer passes batchId and trainerId", async () => {
    const trainerId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    mockFns.assignTrainer.mockResolvedValue({ id: "t1" });
    await request(app)
      .post("/api/batches/b1/trainers")
      .send({ trainerId });
    expect(mockFns.assignTrainer).toHaveBeenCalledWith("b1", trainerId);
  });

  it("removeTrainer passes batchId and trainerId", async () => {
    mockFns.removeTrainer.mockResolvedValue(undefined);
    await request(app).delete("/api/batches/b1/trainers/t1");
    expect(mockFns.removeTrainer).toHaveBeenCalledWith("b1", "t1");
  });

  it("createSession passes batchId and body", async () => {
    const body = {
      trainerId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Session",
      scheduledDate: "2026-10-15",
      startTime: "2026-10-15T09:00:00Z",
      endTime: "2026-10-15T11:00:00Z",
    };
    mockFns.createSession.mockResolvedValue({ id: "sess1" });
    await request(app).post("/api/batches/b1/sessions").send(body);
    const call = mockFns.createSession.mock.calls[0];
    expect(call[0]).toBe("b1");
    expect(call[1].trainerId).toBe(body.trainerId);
    expect(call[1].title).toBe("Session");
    expect(call[1].scheduledDate).toBeDefined();
    expect(call[1].startTime).toBeDefined();
    expect(call[1].endTime).toBeDefined();
  });

  it("getSessionById passes correct id", async () => {
    mockFns.getSessionById.mockResolvedValue({ id: "sess1" });
    await request(app).get("/api/sessions/sess1");
    expect(mockFns.getSessionById).toHaveBeenCalledWith("sess1");
  });

  it("updateSession passes id and body", async () => {
    mockFns.updateSession.mockResolvedValue({});
    await request(app).put("/api/sessions/sess1").send({ title: "New" });
    expect(mockFns.updateSession).toHaveBeenCalledWith("sess1", { title: "New" });
  });

  it("deleteSession passes correct id", async () => {
    mockFns.deleteSession.mockResolvedValue(undefined);
    await request(app).delete("/api/sessions/sess1");
    expect(mockFns.deleteSession).toHaveBeenCalledWith("sess1");
  });
});
