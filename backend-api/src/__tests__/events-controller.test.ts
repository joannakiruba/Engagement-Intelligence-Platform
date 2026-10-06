import { Request, Response, NextFunction } from 'express';

jest.mock('../services/events.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  closeEvent: jest.fn(),
  reopenEvent: jest.fn(),
  deleteEvent: jest.fn(),
  addRound: jest.fn(),
  updateRound: jest.fn(),
  deleteRound: jest.fn(),
  listEvents: jest.fn(),
  getEventById: jest.fn(),
  getStudentEvents: jest.fn(),
  setStudentRegistrationStatus: jest.fn(),
  getEventRegistrations: jest.fn(),
}));

import {
  createEventHandler,
  updateEventHandler,
  closeEventHandler,
  reopenEventHandler,
  deleteEventHandler,
  addRoundHandler,
  updateRoundHandler,
  deleteRoundHandler,
  listEventsHandler,
  getEventHandler,
  studentEventsHandler,
  setStatusHandler,
  getRegistrationsHandler,
} from '../controllers/events.controller';

import {
  ServiceError,
  createEvent,
  updateEvent,
  closeEvent,
  reopenEvent,
  deleteEvent,
  addRound,
  updateRound,
  deleteRound,
  listEvents,
  getEventById,
  getStudentEvents,
  setStudentRegistrationStatus,
  getEventRegistrations,
} from '../services/events.service';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: { sub: UUID, roleId: 'role-1' },
    heldPermissions: new Set<string>(),
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const next: NextFunction = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ───── createEventHandler ─────

describe('Events Controller — createEventHandler', () => {
  it('passes scope batch when events:create:batch held', async () => {
    (createEvent as jest.Mock).mockResolvedValue({ id: 'e1' });
    const req = mockReq({
      body: { title: 'Test Event' },
      heldPermissions: new Set(['events:create:batch']),
    } as any);
    const res = mockRes();

    await createEventHandler(req, res, next);

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Event' }),
      UUID,
      'batch',
    );
  });

  it('passes scope any when events:create:any held', async () => {
    (createEvent as jest.Mock).mockResolvedValue({ id: 'e1' });
    const req = mockReq({
      body: { title: 'Test Event' },
      heldPermissions: new Set(['events:create:any']),
    } as any);
    const res = mockRes();

    await createEventHandler(req, res, next);

    expect(createEvent).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      'any',
    );
  });

  it('returns 201', async () => {
    (createEvent as jest.Mock).mockResolvedValue({ id: 'e1' });
    const req = mockReq({ body: { title: 'Test' } });
    const res = mockRes();

    await createEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ───── updateEventHandler ─────

describe('Events Controller — updateEventHandler', () => {
  it('returns 200', async () => {
    (updateEvent as jest.Mock).mockResolvedValue({ id: UUID });
    const req = mockReq({ params: { id: UUID }, body: { title: 'Updated' } });
    const res = mockRes();

    await updateEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes scope correctly', async () => {
    (updateEvent as jest.Mock).mockResolvedValue({ id: UUID });
    const req = mockReq({
      params: { id: UUID },
      body: { title: 'Updated' },
      heldPermissions: new Set(['events:update:any']),
    } as any);
    const res = mockRes();

    await updateEventHandler(req, res, next);

    expect(updateEvent).toHaveBeenCalledWith(UUID, expect.anything(), UUID, 'any');
  });
});

// ───── closeEvent / reopenEvent ─────

describe('Events Controller — closeEventHandler', () => {
  it('returns 200', async () => {
    (closeEvent as jest.Mock).mockResolvedValue({ id: UUID, closedAt: new Date().toISOString() });
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await closeEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('Events Controller — reopenEventHandler', () => {
  it('returns 200', async () => {
    (reopenEvent as jest.Mock).mockResolvedValue({ id: UUID, closedAt: null });
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await reopenEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ───── deleteEventHandler ─────

describe('Events Controller — deleteEventHandler', () => {
  it('returns 200', async () => {
    (deleteEvent as jest.Mock).mockResolvedValue({ message: 'Deleted' });
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await deleteEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 409 when registrations exist', async () => {
    (deleteEvent as jest.Mock).mockRejectedValue(
      new ServiceError('Cannot delete event with non-PENDING registrations. Close it instead.', 409),
    );
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await deleteEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ───── getEventHandler ─────

describe('Events Controller — getEventHandler', () => {
  it('derives scope any when events:read:any held', async () => {
    (getEventById as jest.Mock).mockResolvedValue({ id: UUID });
    const req = mockReq({
      params: { id: UUID },
      heldPermissions: new Set(['events:read:any']),
    } as any);
    const res = mockRes();

    await getEventHandler(req, res, next);

    expect(getEventById).toHaveBeenCalledWith(UUID, UUID, 'any', undefined);
  });

  it('derives scope batch when events:read:batch held', async () => {
    (getEventById as jest.Mock).mockResolvedValue({ id: UUID });
    const req = mockReq({
      params: { id: UUID },
      heldPermissions: new Set(['events:read:batch']),
    } as any);
    const res = mockRes();

    await getEventHandler(req, res, next);

    expect(getEventById).toHaveBeenCalledWith(UUID, UUID, 'batch', undefined);
  });

  it('derives scope own by default', async () => {
    (getEventById as jest.Mock).mockResolvedValue({ id: UUID });
    const req = mockReq({
      params: { id: UUID },
      heldPermissions: new Set(['events:read:own']),
    } as any);
    const res = mockRes();

    await getEventHandler(req, res, next);

    expect(getEventById).toHaveBeenCalledWith(UUID, UUID, 'own', undefined);
  });

  it('returns 404 via ServiceError', async () => {
    (getEventById as jest.Mock).mockRejectedValue(new ServiceError('Event not found.', 404));
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await getEventHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ───── listEventsHandler ─────

describe('Events Controller — listEventsHandler', () => {
  it('clamps page and limit', async () => {
    (listEvents as jest.Mock).mockResolvedValue({ events: [], total: 0 });
    const req = mockReq({ query: { page: '-1', limit: '999' } });
    const res = mockRes();

    await listEventsHandler(req, res, next);

    expect(listEvents).toHaveBeenCalledWith(
      expect.any(Object),
      UUID,
      expect.any(String),
      1,
      100,
    );
  });

  it('passes filters (category, batchId)', async () => {
    (listEvents as jest.Mock).mockResolvedValue({ events: [], total: 0 });
    const req = mockReq({ query: { category: 'CODING', batchId: UUID2 } });
    const res = mockRes();

    await listEventsHandler(req, res, next);

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'CODING', batchId: UUID2 }),
      UUID,
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
    );
  });
});

// ───── studentEventsHandler ─────

describe('Events Controller — studentEventsHandler', () => {
  it('uppercases category', async () => {
    (getStudentEvents as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ query: { category: 'coding' } });
    const res = mockRes();

    await studentEventsHandler(req, res, next);

    expect(getStudentEvents).toHaveBeenCalledWith(
      UUID,
      expect.objectContaining({ category: 'CODING' }),
    );
  });

  it('calls getStudentEvents with userId', async () => {
    (getStudentEvents as jest.Mock).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();

    await studentEventsHandler(req, res, next);

    expect(getStudentEvents).toHaveBeenCalledWith(UUID, expect.any(Object));
  });
});

// ───── setStatusHandler ─────

describe('Events Controller — setStatusHandler', () => {
  it('returns 200', async () => {
    (setStudentRegistrationStatus as jest.Mock).mockResolvedValue({ id: 'reg-1', status: 'REGISTERED' });
    const req = mockReq({ params: { id: UUID }, body: { status: 'REGISTERED' } });
    const res = mockRes();

    await setStatusHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards 409 for closed event', async () => {
    (setStudentRegistrationStatus as jest.Mock).mockRejectedValue(
      new ServiceError('Event is closed.', 409),
    );
    const req = mockReq({ params: { id: UUID }, body: { status: 'REGISTERED' } });
    const res = mockRes();

    await setStatusHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ───── getRegistrationsHandler ─────

describe('Events Controller — getRegistrationsHandler', () => {
  it('passes status filter', async () => {
    (getEventRegistrations as jest.Mock).mockResolvedValue({ registrations: [], statusCounts: {} });
    const req = mockReq({ params: { id: UUID }, query: { status: 'REGISTERED' } });
    const res = mockRes();

    await getRegistrationsHandler(req, res, next);

    expect(getEventRegistrations).toHaveBeenCalledWith(UUID, UUID, expect.any(String), 'REGISTERED');
  });
});

// ───── Round handlers ─────

describe('Events Controller — round handlers', () => {
  it('addRound returns 201', async () => {
    (addRound as jest.Mock).mockResolvedValue({ id: 'r1', name: 'Round 1' });
    const req = mockReq({ params: { id: UUID }, body: { name: 'Round 1' } });
    const res = mockRes();

    await addRoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updateRound returns 200', async () => {
    (updateRound as jest.Mock).mockResolvedValue({ id: 'r1', name: 'Updated' });
    const req = mockReq({ params: { id: UUID, roundId: 'r1' }, body: { name: 'Updated' } });
    const res = mockRes();

    await updateRoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deleteRound returns 200', async () => {
    (deleteRound as jest.Mock).mockResolvedValue({ message: 'Deleted' });
    const req = mockReq({ params: { id: UUID, roundId: 'r1' } });
    const res = mockRes();

    await deleteRoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
