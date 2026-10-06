/**
 * Integration tests for weekly report scheduling against a real Redis instance.
 *
 * Requires: Redis running on port 6380 (disposable).
 * Run:  REDIS_HOST=localhost REDIS_PORT=6380 \
 *       npx jest --testPathPatterns='weekly-report-redis' --no-coverage --forceExit
 */
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6380', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';

let redis: Redis;
let testQueue: Queue;
let testWorker: Worker | null = null;

beforeAll(async () => {
  redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null, db: 2 });
  await redis.flushdb();

  testQueue = new Queue('weekly-report-test', {
    connection: new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null, db: 2 }),
  });
});

afterEach(async () => {
  if (testWorker) {
    await testWorker.close();
    testWorker = null;
  }
  await testQueue.drain();
});

afterAll(async () => {
  await testQueue.obliterate({ force: true });
  await testQueue.close();
  await redis.flushdb();
  await redis.quit();
});

// ---------------------------------------------------------------------------
// 1. upsertJobScheduler works with BullMQ 6.3.8
// ---------------------------------------------------------------------------
test('upsertJobScheduler creates a scheduler without error', async () => {
  await expect(
    testQueue.upsertJobScheduler(
      'test-scheduler',
      { pattern: '0 9 * * 1' },
      { name: 'weekly-report-trigger', data: {} },
    ),
  ).resolves.not.toThrow();

  const schedulers = await testQueue.getJobSchedulers();
  expect(schedulers.length).toBeGreaterThanOrEqual(1);
  const ours = schedulers.find((s: any) => s.id === 'test-scheduler' || s.key === 'test-scheduler');
  expect(ours).toBeDefined();
});

// ---------------------------------------------------------------------------
// 2. Repeated initialization is idempotent
// ---------------------------------------------------------------------------
test('calling upsertJobScheduler twice does not create duplicates', async () => {
  await testQueue.upsertJobScheduler(
    'test-scheduler',
    { pattern: '0 9 * * 1' },
    { name: 'weekly-report-trigger', data: {} },
  );

  await testQueue.upsertJobScheduler(
    'test-scheduler',
    { pattern: '0 9 * * 1' },
    { name: 'weekly-report-trigger', data: {} },
  );

  const schedulers = await testQueue.getJobSchedulers();
  const ours = schedulers.filter((s: any) => (s.id || s.key) === 'test-scheduler');
  expect(ours.length).toBe(1);
});

// ---------------------------------------------------------------------------
// 3. Updating the cron pattern works
// ---------------------------------------------------------------------------
test('upsertJobScheduler updates existing scheduler cron pattern', async () => {
  await testQueue.upsertJobScheduler(
    'test-scheduler',
    { pattern: '0 10 * * 2' },
    { name: 'weekly-report-trigger', data: {} },
  );

  const schedulers = await testQueue.getJobSchedulers();
  const ours = schedulers.find((s: any) => (s.id || s.key) === 'test-scheduler');
  expect(ours).toBeDefined();
  expect((ours as any).pattern || (ours as any).cron).toMatch(/10/);
});

// ---------------------------------------------------------------------------
// 4. Actual job processing via worker
// ---------------------------------------------------------------------------
test('worker processes a queued job', async () => {
  const processed: any[] = [];

  testWorker = new Worker(
    'weekly-report-test',
    async (job: Job) => {
      processed.push(job.data);
      return { success: true };
    },
    {
      connection: new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null, db: 2 }),
    },
  );

  const weekStart = new Date('2026-09-28T00:00:00.000Z');
  const weekEnd = new Date('2026-10-05T00:00:00.000Z');

  await testQueue.add('weekly-report', {
    mentorId: 'mentor-001',
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });

  await new Promise<void>((resolve) => {
    testWorker!.on('completed', () => resolve());
    setTimeout(resolve, 5000);
  });

  expect(processed.length).toBe(1);
  expect(processed[0].mentorId).toBe('mentor-001');
  expect(processed[0].weekStart).toBe('2026-09-28T00:00:00.000Z');
  expect(processed[0].weekEnd).toBe('2026-10-05T00:00:00.000Z');
});

// ---------------------------------------------------------------------------
// 5. Safe custom job IDs for deduplication
// ---------------------------------------------------------------------------
test('duplicate jobId is rejected (prevents double dispatch)', async () => {
  const jobId = 'weekly-report-mentor-001-2026-09-28T00-00-00-000Z-2026-10-05T00-00-00-000Z';

  await testQueue.add('weekly-report', { mentorId: 'mentor-001' }, { jobId });

  // Second add with same jobId should not create a new job
  const second = await testQueue.add('weekly-report', { mentorId: 'mentor-001' }, { jobId });

  // BullMQ returns the existing job — both point to the same id
  expect(second.id).toBe(jobId);

  // Only one job should be waiting or completed with that id
  const job = await testQueue.getJob(jobId);
  expect(job).toBeDefined();
});

// ---------------------------------------------------------------------------
// 6. Serialized dates roundtrip correctly
// ---------------------------------------------------------------------------
test('date values survive JSON serialization through Redis', async () => {
  const processed: any[] = [];

  testWorker = new Worker(
    'weekly-report-test',
    async (job: Job) => {
      processed.push(job.data);
      return { success: true };
    },
    {
      connection: new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null, db: 2 }),
    },
  );

  const now = new Date();
  const data = {
    mentorId: 'mentor-date-test',
    weekStart: new Date('2026-09-28T00:00:00.000Z'),
    weekEnd: new Date('2026-10-05T00:00:00.000Z'),
  };

  await testQueue.add('weekly-report', data, { jobId: `date-test-${Date.now()}` });

  await new Promise<void>((resolve) => {
    testWorker!.on('completed', () => resolve());
    setTimeout(resolve, 5000);
  });

  expect(processed.length).toBe(1);
  // BullMQ uses JSON.stringify → Date objects become ISO strings via toJSON()
  // but msgpack or other serializers may differ — verify the roundtrip works
  const ws = processed[0].weekStart;
  const we = processed[0].weekEnd;
  // The value should be parseable back to the original timestamp regardless of format
  const parsedStart = typeof ws === 'string' ? new Date(ws) : new Date(ws);
  const parsedEnd = typeof we === 'string' ? new Date(we) : new Date(we);
  expect(parsedStart.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  expect(parsedEnd.toISOString()).toBe('2026-10-05T00:00:00.000Z');
});

// ---------------------------------------------------------------------------
// 7. Retry does not change the reporting week (data is immutable in the job)
// ---------------------------------------------------------------------------
test('a retried job uses the same week boundaries', async () => {
  const attempts: any[] = [];
  let attempt = 0;

  testWorker = new Worker(
    'weekly-report-test',
    async (job: Job) => {
      attempt++;
      attempts.push({ ...job.data, attempt });
      if (attempt === 1) throw new Error('Simulated transient failure');
      return { success: true };
    },
    {
      connection: new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null, db: 2 }),
    },
  );

  await testQueue.add(
    'weekly-report',
    {
      mentorId: 'mentor-retry',
      weekStart: '2026-09-28T00:00:00.000Z',
      weekEnd: '2026-10-05T00:00:00.000Z',
    },
    {
      jobId: `retry-test-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'fixed', delay: 100 },
    },
  );

  await new Promise<void>((resolve) => {
    testWorker!.on('completed', () => resolve());
    setTimeout(resolve, 10000);
  });

  expect(attempts.length).toBe(2);
  expect(attempts[0].weekStart).toBe(attempts[1].weekStart);
  expect(attempts[0].weekEnd).toBe(attempts[1].weekEnd);
  expect(attempts[0].mentorId).toBe(attempts[1].mentorId);
});
