import express from "express";
import request from "supertest";

const fns = {
  maFindMany: jest.fn(),
  maFindUnique: jest.fn(),
  maCreate: jest.fn(),
  maDelete: jest.fn(),
  userFindUnique: jest.fn(),
};

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    mentorAssignment: {
      findMany: (...a: any[]) => fns.maFindMany(...a),
      findUnique: (...a: any[]) => fns.maFindUnique(...a),
      create: (...a: any[]) => fns.maCreate(...a),
      delete: (...a: any[]) => fns.maDelete(...a),
    },
    user: {
      findUnique: (...a: any[]) => fns.userFindUnique(...a),
    },
  },
}));

const mockPrisma = {
  mentorAssignment: {
    findMany: fns.maFindMany,
    findUnique: fns.maFindUnique,
    create: fns.maCreate,
    delete: fns.maDelete,
  },
  user: { findUnique: fns.userFindUnique },
};

import mentorAssignmentRoutes from "../routes/mentor-assignments.routes";
import { errorHandler } from "../middleware/error.middleware";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mentor-assignments", mentorAssignmentRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockPrisma.mentorAssignment).forEach((fn) => fn.mockReset());
  mockPrisma.user.findUnique.mockReset();
});

const ASSIGNMENT = {
  id: "ma-1",
  mentorId: "mentor-1",
  studentId: "student-1",
  assignedAt: new Date().toISOString(),
};

// ===========================================
// LIST
// ===========================================

describe("GET /api/mentor-assignments", () => {
  it("returns all assignments", async () => {
    mockPrisma.mentorAssignment.findMany.mockResolvedValue([ASSIGNMENT]);
    const res = await request(app).get("/api/mentor-assignments");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters by mentorId", async () => {
    mockPrisma.mentorAssignment.findMany.mockResolvedValue([]);
    await request(app).get("/api/mentor-assignments?mentorId=mentor-1");
    expect(mockPrisma.mentorAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mentorId: "mentor-1" } })
    );
  });

  it("filters by studentId", async () => {
    mockPrisma.mentorAssignment.findMany.mockResolvedValue([]);
    await request(app).get("/api/mentor-assignments?studentId=student-1");
    expect(mockPrisma.mentorAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "student-1" } })
    );
  });
});

// ===========================================
// GET BY ID
// ===========================================

describe("GET /api/mentor-assignments/:id", () => {
  it("returns assignment when found", async () => {
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue(ASSIGNMENT);
    const res = await request(app).get("/api/mentor-assignments/ma-1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("ma-1");
  });

  it("returns 404 when not found", async () => {
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/mentor-assignments/missing");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// CREATE
// ===========================================

describe("POST /api/mentor-assignments", () => {
  const payload = {
    mentorId: "a0000000-0000-0000-0000-000000000001",
    studentId: "b0000000-0000-0000-0000-000000000001",
  };

  it("creates assignment successfully", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: payload.mentorId })
      .mockResolvedValueOnce({ id: payload.studentId });
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.mentorAssignment.create.mockResolvedValue({ id: "new-1", ...payload });

    const res = await request(app).post("/api/mentor-assignments").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("rejects missing mentorId", async () => {
    const res = await request(app).post("/api/mentor-assignments").send({ studentId: payload.studentId });
    expect(res.status).toBe(400);
  });

  it("rejects missing studentId", async () => {
    const res = await request(app).post("/api/mentor-assignments").send({ mentorId: payload.mentorId });
    expect(res.status).toBe(400);
  });

  it("rejects non-UUID mentorId", async () => {
    const res = await request(app).post("/api/mentor-assignments").send({ mentorId: "not-uuid", studentId: payload.studentId });
    expect(res.status).toBe(400);
  });

  it("returns 404 when mentor not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/mentor-assignments").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Mentor");
  });

  it("returns 404 when student not found", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: payload.mentorId })
      .mockResolvedValueOnce(null);
    const res = await request(app).post("/api/mentor-assignments").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Student");
  });

  it("returns 409 when duplicate", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: payload.mentorId })
      .mockResolvedValueOnce({ id: payload.studentId });
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue({ id: "existing" });

    const res = await request(app).post("/api/mentor-assignments").send(payload);
    expect(res.status).toBe(409);
  });
});

// ===========================================
// DELETE
// ===========================================

describe("DELETE /api/mentor-assignments/:id", () => {
  it("deletes assignment", async () => {
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue(ASSIGNMENT);
    mockPrisma.mentorAssignment.delete.mockResolvedValue(ASSIGNMENT);

    const res = await request(app).delete("/api/mentor-assignments/ma-1");
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.mentorAssignment.findUnique.mockResolvedValue(null);
    const res = await request(app).delete("/api/mentor-assignments/missing");
    expect(res.status).toBe(404);
  });
});
