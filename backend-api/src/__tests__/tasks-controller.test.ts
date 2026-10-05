import { Request, Response, NextFunction } from 'express';

jest.mock('../services/tasks.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  createTask: jest.fn(),
  updateTask: jest.fn(),
  listTasks: jest.fn(),
  getTaskById: jest.fn(),
  changeDeadline: jest.fn(),
  closeTask: jest.fn(),
  reopenTask: jest.fn(),
  deleteTask: jest.fn(),
  getStudentTasks: jest.fn(),
  updateStudentProgress: jest.fn(),
  toggleInterested: jest.fn(),
  addStudentToTask: jest.fn(),
  setMarks: jest.fn(),
  bulkSetMarks: jest.fn(),
  exportMarks: jest.fn(),
}));

import {
  createTaskHandler,
  updateTaskHandler,
  listTasksHandler,
  getTaskHandler,
  changeDeadlineHandler,
  closeTaskHandler,
  reopenTaskHandler,
  deleteTaskHandler,
  studentTasksHandler,
  updateProgressHandler,
  toggleInterestedHandler,
  addStudentHandler,
  setMarksHandler,
  bulkSetMarksHandler,
  exportMarksHandler,
} from '../controllers/tasks.controller';

import {
  ServiceError,
  createTask,
  updateTask,
  listTasks,
  getTaskById,
  changeDeadline,
  closeTask,
  reopenTask,
  deleteTask,
  getStudentTasks,
  updateStudentProgress,
  toggleInterested,
  addStudentToTask,
  setMarks,
  bulkSetMarks,
  exportMarks,
} from '../services/tasks.service';

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

describe('createTaskHandler', () => {
  it('returns 201 on success', async () => {
    const task = { id: UUID, title: 'Test Task' };
    (createTask as jest.Mock).mockResolvedValue(task);

    const req = mockReq({ body: { title: 'Test Task', batchIds: [UUID2] } });
    const res = mockRes();

    await createTaskHandler(req, res, next);

    expect(createTask).toHaveBeenCalledWith(req.body, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: task }));
  });

  it('resolves scope to "any" when permission is held', async () => {
    const task = { id: UUID, title: 'Test Task' };
    (createTask as jest.Mock).mockResolvedValue(task);

    const req = mockReq({
      body: { title: 'Test Task', batchIds: [UUID2] },
      heldPermissions: new Set(['tasks:create:any']),
    } as any);
    const res = mockRes();

    await createTaskHandler(req, res, next);

    expect(createTask).toHaveBeenCalledWith(req.body, UUID, 'any');
  });

  it('forwards ServiceError to response', async () => {
    (createTask as jest.Mock).mockRejectedValue(new ServiceError('Batches not found', 404));

    const req = mockReq({ body: { title: 'Test', batchIds: ['bad-id'] } });
    const res = mockRes();

    await createTaskHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateTaskHandler', () => {
  it('returns 200 on success', async () => {
    const task = { id: UUID, title: 'Updated' };
    (updateTask as jest.Mock).mockResolvedValue(task);

    const req = mockReq({ params: { id: UUID } as any, body: { title: 'Updated' } });
    const res = mockRes();

    await updateTaskHandler(req, res, next);

    expect(updateTask).toHaveBeenCalledWith(UUID, req.body, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('listTasksHandler', () => {
  it('returns paginated result', async () => {
    const result = { data: [], total: 0, page: 1, limit: 20 };
    (listTasks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await listTasksHandler(req, res, next);

    expect(listTasks).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes query filters correctly', async () => {
    const result = { data: [], total: 0, page: 2, limit: 10 };
    (listTasks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      query: {
        batchId: UUID2,
        isMandatory: 'true',
        deadlineType: 'FIXED',
        status: 'open',
        search: 'test',
        page: '2',
        limit: '10',
      },
    });
    const res = mockRes();

    await listTasksHandler(req, res, next);

    const filters = (listTasks as jest.Mock).mock.calls[0][0];
    expect(filters.batchId).toBe(UUID2);
    expect(filters.isMandatory).toBe(true);
    expect(filters.deadlineType).toBe('FIXED');
    expect(filters.status).toBe('open');
    expect(filters.search).toBe('test');
    expect(filters.page).toBe(2);
    expect(filters.limit).toBe(10);
  });
});

describe('getTaskHandler', () => {
  it('returns task with scope resolution', async () => {
    const task = { id: UUID, title: 'Task' };
    (getTaskById as jest.Mock).mockResolvedValue(task);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await getTaskHandler(req, res, next);

    expect(getTaskById).toHaveBeenCalledWith(UUID, UUID, 'own', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resolves "batch" scope correctly', async () => {
    const task = { id: UUID, title: 'Task' };
    (getTaskById as jest.Mock).mockResolvedValue(task);

    const req = mockReq({
      params: { id: UUID } as any,
      heldPermissions: new Set(['tasks:read:batch']),
    } as any);
    const res = mockRes();

    await getTaskHandler(req, res, next);

    expect(getTaskById).toHaveBeenCalledWith(UUID, UUID, 'batch', undefined);
  });

  it('passes progress filter when provided', async () => {
    const task = { id: UUID, title: 'Task' };
    (getTaskById as jest.Mock).mockResolvedValue(task);

    const req = mockReq({
      params: { id: UUID } as any,
      query: { progress: 'COMPLETED' },
    });
    const res = mockRes();

    await getTaskHandler(req, res, next);

    expect(getTaskById).toHaveBeenCalledWith(UUID, UUID, 'own', 'COMPLETED');
  });
});

describe('changeDeadlineHandler', () => {
  it('calls changeDeadline with correct args', async () => {
    const result = { id: UUID, deadlineType: 'FIXED' };
    (changeDeadline as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { deadlineType: 'FIXED', deadline: '2027-01-01T00:00:00Z' },
    });
    const res = mockRes();

    await changeDeadlineHandler(req, res, next);

    expect(changeDeadline).toHaveBeenCalledWith(UUID, req.body, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('closeTaskHandler', () => {
  it('calls closeTask and returns 200', async () => {
    const result = { id: UUID, closedAt: new Date() };
    (closeTask as jest.Mock).mockResolvedValue(result);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await closeTaskHandler(req, res, next);

    expect(closeTask).toHaveBeenCalledWith(UUID, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('reopenTaskHandler', () => {
  it('calls reopenTask and returns 200', async () => {
    const result = { id: UUID, closedAt: null };
    (reopenTask as jest.Mock).mockResolvedValue(result);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await reopenTaskHandler(req, res, next);

    expect(reopenTask).toHaveBeenCalledWith(UUID, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deleteTaskHandler', () => {
  it('calls deleteTask and returns success message', async () => {
    (deleteTask as jest.Mock).mockResolvedValue(undefined);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await deleteTaskHandler(req, res, next);

    expect(deleteTask).toHaveBeenCalledWith(UUID, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { message: 'Task deleted successfully' } }),
    );
  });

  it('forwards ServiceError for tasks with progress', async () => {
    (deleteTask as jest.Mock).mockRejectedValue(
      new ServiceError('Cannot delete task: students have started working on it', 409),
    );

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await deleteTaskHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('studentTasksHandler', () => {
  it('returns student tasks', async () => {
    const tasks = [{ id: UUID, title: 'My Task' }];
    (getStudentTasks as jest.Mock).mockResolvedValue(tasks);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await studentTasksHandler(req, res, next);

    expect(getStudentTasks).toHaveBeenCalledWith(UUID, {});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes filters from query', async () => {
    (getStudentTasks as jest.Mock).mockResolvedValue([]);

    const req = mockReq({
      query: { batchId: UUID2, progress: 'IN_PROGRESS', isMandatory: 'true', status: 'open' },
    });
    const res = mockRes();

    await studentTasksHandler(req, res, next);

    const filters = (getStudentTasks as jest.Mock).mock.calls[0][1];
    expect(filters.batchId).toBe(UUID2);
    expect(filters.progress).toBe('IN_PROGRESS');
    expect(filters.isMandatory).toBe(true);
    expect(filters.status).toBe('open');
  });
});

describe('updateProgressHandler', () => {
  it('updates student progress', async () => {
    const result = { id: 'sub-1', progress: 'IN_PROGRESS' };
    (updateStudentProgress as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { progress: 'IN_PROGRESS' },
    });
    const res = mockRes();

    await updateProgressHandler(req, res, next);

    expect(updateStudentProgress).toHaveBeenCalledWith(UUID, UUID, 'IN_PROGRESS');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('toggleInterestedHandler', () => {
  it('toggles interest', async () => {
    const result = { id: 'sub-1', isInterested: true };
    (toggleInterested as jest.Mock).mockResolvedValue(result);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await toggleInterestedHandler(req, res, next);

    expect(toggleInterested).toHaveBeenCalledWith(UUID, UUID);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('addStudentHandler', () => {
  it('adds student to task', async () => {
    const result = { id: 'sub-1', studentId: UUID2 };
    (addStudentToTask as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { studentId: UUID2 },
    });
    const res = mockRes();

    await addStudentHandler(req, res, next);

    expect(addStudentToTask).toHaveBeenCalledWith(UUID, UUID2, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('setMarksHandler', () => {
  it('sets marks for a student', async () => {
    const result = { id: 'sub-1', marksAwarded: 85 };
    (setMarks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { studentId: UUID2, marksAwarded: 85 },
    });
    const res = mockRes();

    await setMarksHandler(req, res, next);

    expect(setMarks).toHaveBeenCalledWith(UUID, req.body, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('bulkSetMarksHandler', () => {
  it('returns 200 when all entries succeed', async () => {
    const result = { total: 2, updated: 2, errors: 0, details: [] };
    (bulkSetMarks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { entries: [{ studentId: UUID2, marksAwarded: 90 }] },
    });
    const res = mockRes();

    await bulkSetMarksHandler(req, res, next);

    expect(bulkSetMarks).toHaveBeenCalledWith(UUID, req.body.entries, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 207 when some entries fail', async () => {
    const result = { total: 2, updated: 1, errors: 1, details: [] };
    (bulkSetMarks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({
      params: { id: UUID } as any,
      body: { entries: [] },
    });
    const res = mockRes();

    await bulkSetMarksHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(207);
  });
});

describe('exportMarksHandler', () => {
  it('exports marks', async () => {
    const result = { task: { id: UUID }, submissions: [] };
    (exportMarks as jest.Mock).mockResolvedValue(result);

    const req = mockReq({ params: { id: UUID } as any });
    const res = mockRes();

    await exportMarksHandler(req, res, next);

    expect(exportMarks).toHaveBeenCalledWith(UUID, UUID, 'batch');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
