import express from "express";
import request from "supertest";

const fns = {
  attFindMany: jest.fn(),
  attFindUnique: jest.fn(),
  attCreate: jest.fn(),
  attUpdate: jest.fn(),
  attDelete: jest.fn(),
  attUpsert: jest.fn(),
  sessFindUnique: jest.fn(),
  userFindUnique: jest.fn(),
};

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    attendance: {
      findMany: (...a: any[]) => fns.attFindMany(...a),
      findUnique: (...a: any[]) => fns.attFindUnique(...a),
      create: (...a: any[]) => fns.attCreate(...a),
      update: (...a: any[]) => fns.attUpdate(...a),
      delete: (...a: any[]) => fns.attDelete(...a),
      upsert: (...a: any[]) => fns.attUpsert(...a),
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
  attendance: {
    findMany: fns.attFindMany,
    findUnique: fns.attFindUnique,
    create: fns.attCreate,
    update: fns.attUpdate,
    delete: fns.attDelete,
    upsert: fns.attUpsert,
  },
  session: { findUnique: fns.sessFindUnique },
  user: { findUnique: fns.userFindUnique },
};

import attendanceRoutes from "../routes/attendance.routes";
import { errorHandler } from "../middleware/error.middleware";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", attendanceRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockPrisma.attendance).forEach((fn) => fn.mockReset());
  mockPrisma.session.findUnique.mockReset();
  mockPrisma.user.findUnique.mockReset();
});

const RECORD = {
  id: "att-1",
  sessionId: "sess-1",
  studentId: "stu-1",
  status: "PRESENT",
  checkInTime: null,
  remarks: null,
  createdAt: new Date().toISOString(),
};

// ===========================================
// LIST
// ===========================================

describe("GET /api/attendance", () => {
  it("returns all records", async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([RECORD]);
    const res = await request(app).get("/api/attendance");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters by sessionId", async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    await request(app).get("/api/attendance?sessionId=sess-1");
    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "sess-1" } })
    );
  });

  it("filters by studentId", async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    await request(app).get("/api/attendance?studentId=stu-1");
    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-1" } })
    );
  });
});

// ===========================================
// GET BY ID
// ===========================================

describe("GET /api/attendance/:id", () => {
  it("returns record when found", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(RECORD);
    const res = await request(app).get("/api/attendance/att-1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("att-1");
  });

  it("returns 404 when not found", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/attendance/missing");
    expect(res.status).toBe(404);
  });
});

// ===========================================
// MARK ATTENDANCE
// ===========================================

describe("POST /api/attendance", () => {
  const payload = {
    sessionId: "a0000000-0000-0000-0000-000000000001",
    studentId: "b0000000-0000-0000-0000-000000000001",
    status: "PRESENT",
  };

  it("creates record successfully", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique.mockResolvedValue({ id: payload.studentId });
    mockPrisma.attendance.findUnique.mockResolvedValue(null);
    mockPrisma.attendance.create.mockResolvedValue({ id: "new-1", ...payload });

    const res = await request(app).post("/api/attendance").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("rejects missing required fields", async () => {
    const res = await request(app).post("/api/attendance").send({ sessionId: payload.sessionId });
    expect(res.status).toBe(400);
  });

  it("rejects invalid status", async () => {
    const res = await request(app).post("/api/attendance").send({ ...payload, status: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/attendance").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Session");
  });

  it("returns 404 when student not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/attendance").send(payload);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Student");
  });

  it("returns 409 when duplicate", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.user.findUnique.mockResolvedValue({ id: payload.studentId });
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: "existing" });

    const res = await request(app).post("/api/attendance").send(payload);
    expect(res.status).toBe(409);
  });
});

// ===========================================
// BULK MARK
// ===========================================

describe("POST /api/attendance/bulk", () => {
  const payload = {
    sessionId: "a0000000-0000-0000-0000-000000000001",
    records: [
      { studentId: "b0000000-0000-0000-0000-000000000001", status: "PRESENT" },
      { studentId: "b0000000-0000-0000-0000-000000000002", status: "ABSENT" },
    ],
  };

  it("creates bulk records", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.attendance.findUnique.mockResolvedValue(null);
    mockPrisma.attendance.create.mockResolvedValue({});

    const res = await request(app).post("/api/attendance/bulk").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
  });

  it("skips already-existing records", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: payload.sessionId });
    mockPrisma.attendance.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);
    mockPrisma.attendance.create.mockResolvedValue({});

    const res = await request(app).post("/api/attendance/bulk").send(payload);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skipped).toBe(1);
  });

  it("returns 404 when session not found", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/attendance/bulk").send(payload);
    expect(res.status).toBe(404);
  });

  it("rejects empty records array", async () => {
    const res = await request(app).post("/api/attendance/bulk").send({
      sessionId: payload.sessionId,
      records: [],
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================
// UPDATE
// ===========================================

describe("PUT /api/attendance/:id", () => {
  it("updates record", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(RECORD);
    mockPrisma.attendance.update.mockResolvedValue({ ...RECORD, status: "LATE" });

    const res = await request(app).put("/api/attendance/att-1").send({ status: "LATE" });
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null);
    const res = await request(app).put("/api/attendance/missing").send({ status: "LATE" });
    expect(res.status).toBe(404);
  });

  it("rejects empty body", async () => {
    const res = await request(app).put("/api/attendance/att-1").send({});
    expect(res.status).toBe(400);
  });
});

// ===========================================
// DELETE
// ===========================================

describe("DELETE /api/attendance/:id", () => {
  it("deletes record", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(RECORD);
    mockPrisma.attendance.delete.mockResolvedValue(RECORD);

    const res = await request(app).delete("/api/attendance/att-1");
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null);
    const res = await request(app).delete("/api/attendance/missing");
    expect(res.status).toBe(404);
  });
});
