import express from "express";
import request from "supertest";

const fns = {
  fbFindMany: jest.fn(),
  fbFindUnique: jest.fn(),
  fbCreate: jest.fn(),
  fbUpdate: jest.fn(),
  fbDelete: jest.fn(),
  sessFindUnique: jest.fn(),
  userFindUnique: jest.fn(),
};

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    feedback: {
      findMany: (...a: any[]) => fns.fbFindMany(...a),
      findUnique: (...a: any[]) => fns.fbFindUnique(...a),
      create: (...a: any[]) => fns.fbCreate(...a),
      update: (...a: any[]) => fns.fbUpdate(...a),
      delete: (...a: any[]) => fns.fbDelete(...a),
    },
    session: {
      findUnique: (...a: any[]) => fns.sessFindUnique(...a),
    },
    user: {
      findUnique: (...a: any[]) => fns.userFindUnique(...a),
    },
  },
}));

const mockPrisma = {
  feedback: {
    findMany: fns.fbFindMany,
    findUnique: fns.fbFindUnique,
    create: fns.fbCreate,
    update: fns.fbUpdate,
    delete: fns.fbDelete,
  },
  session: { findUnique: fns.sessFindUnique },
  user: { findUnique: fns.userFindUnique },
};

import feedbackRoutes from "../routes/feedback.routes";
import { errorHandler } from "../middleware/error.middleware";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/feedback", feedbackRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockPrisma.feedback).forEach((fn) => fn.mockReset());
  mockPrisma.session.findUnique.mockReset();
  mockPrisma.user.findUnique.mockReset();
});

const RECORD = {
  id: "fb-1",
  sessionId: "sess-1",
  studentId: "stu-1",
  trainerId: "tr-1",
  effortRating: 4,
  participationRating: 3,
  comments: "Good effort",
  createdAt: new Date().toISOString(),
};

// ===========================================
// LIST
// ===========================================

describe("GET /api/feedback", () => {
  it("returns all records", async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([RECORD]);
    const res = await request(app).get("/api/feedback");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters by sessionId", async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    await request(app).get("/api/feedback?sessionId=sess-1");
    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "sess-1" } })
    );
  });

  it("filters by studentId and trainerId", async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    await request(app).get("/api/feedback?studentId=stu-1&trainerId=tr-1");
    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-1", trainerId: "tr-1" } })
    );
  });
});

// ===========================================
// GET BY ID
// ===========================================

describe("GET /api/feedback/:id", () => {
  it("returns record when found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(RECORD);
    const res = await request(app).get("/api/feedback/fb-1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("fb-1");
  });

  it("returns 404 when not found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/feedback/missing");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// CREATE
// ===========================================

describe("POST /api/feedback", () => {
  const payload = {
    sessionId: "a0000000-0000-0000-0000-000000000001",
    studentId: "b0000000-0000-0000-0000-000000000001",
    trainerId: "c0000000-0000-0000-0000-000000000001",
    effortRating: 4,
    participationRating: 3,
    comments: "Good work",
  };

  it("creates feedback successfully", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: payload.studentId })
      .mockResolvedValueOnce({ id: payload.trainerId });
    mockPrisma.feedback.create.mockResolvedValue({ id: "new-1", ...payload });

    const res = await request(app).post("/api/feedback").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("rejects missing required fields", async () => {
    const res = await request(app).post("/api/feedback").send({ sessionId: payload.sessionId });
    expect(res.status).toBe(400);
  });

  it("rejects effortRating out of range", async () => {
    const res = await request(app).post("/api/feedback").send({ ...payload, effortRating: 6 });
    expect(res.status).toBe(400);
  });

  it("rejects participationRating below 1", async () => {
    const res = await request(app).post("/api/feedback").send({ ...payload, participationRating: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/feedback").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Session");
  });

  it("returns 404 when student not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/feedback").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Student");
  });

  it("returns 404 when trainer not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: payload.studentId })
      .mockResolvedValueOnce(null);
    const res = await request(app).post("/api/feedback").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Trainer");
  });
});

// ===========================================
// UPDATE
// ===========================================

describe("PUT /api/feedback/:id", () => {
  it("updates record", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(RECORD);
    mockPrisma.feedback.update.mockResolvedValue({ ...RECORD, effortRating: 5 });

    const res = await request(app).put("/api/feedback/fb-1").send({ effortRating: 5 });
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(null);
    const res = await request(app).put("/api/feedback/missing").send({ effortRating: 5 });
    expect(res.status).toBe(404);
  });

  it("rejects empty body", async () => {
    const res = await request(app).put("/api/feedback/fb-1").send({});
    expect(res.status).toBe(400);
  });
});

// ===========================================
// DELETE
// ===========================================

describe("DELETE /api/feedback/:id", () => {
  it("deletes record", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(RECORD);
    mockPrisma.feedback.delete.mockResolvedValue(RECORD);

    const res = await request(app).delete("/api/feedback/fb-1");
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(null);
    const res = await request(app).delete("/api/feedback/missing");
    expect(res.status).toBe(404);
  });
});
