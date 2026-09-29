import axios from 'axios';

jest.mock('axios');
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

import {
  generateMentorAlerts,
  getMentorAlerts,
  getStudentAlerts,
  updateAlertStatus,
  recordAlertOutcome,
  getAlertStats,
} from '../services/ml.service';

beforeEach(() => {
  jest.clearAllMocks();
});

const SAMPLE_ALERT = {
  student_id: 'stu-1',
  student_name: 'Alice',
  mentor_id: 'mentor-1',
  mentor_name: 'Dr. Smith',
  priority_score: 85,
  urgency_tier: 'CRITICAL' as const,
  trigger_reason: 'Rapid risk increase',
  risk_score: 78,
  risk_velocity: 15,
  recommended_intervention: 'one_on_one_meeting',
  recommendation_confidence: 0.87,
  recommendation_reasoning: 'First time at high risk',
  contributing_factors: [],
  created_at: new Date().toISOString(),
};

// ─── generateMentorAlerts ───

describe('generateMentorAlerts', () => {
  it('calls ML service and returns response', async () => {
    const expected = { total_students_analyzed: 5, alerts_generated: 2, alerts_filtered: 1, alerts: [SAMPLE_ALERT] };
    mockedAxios.post.mockResolvedValue({ data: expected });

    const result = await generateMentorAlerts('batch-1');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/ml/mentor-alerts/generate'),
      { batch_id: 'batch-1' },
    );
    expect(result.alerts_generated).toBe(2);
  });

  it('passes null batch_id when no batchId provided', async () => {
    mockedAxios.post.mockResolvedValue({ data: { total_students_analyzed: 0, alerts_generated: 0, alerts_filtered: 0, alerts: [] } });
    await generateMentorAlerts();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      { batch_id: null },
    );
  });

  it('throws when ML service is down', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(generateMentorAlerts()).rejects.toThrow('ML service unavailable');
  });
});

// ─── getMentorAlerts ───

describe('getMentorAlerts', () => {
  it('returns alerts for a mentor', async () => {
    mockedAxios.get.mockResolvedValue({ data: { data: [SAMPLE_ALERT] } });
    const result = await getMentorAlerts('mentor-1');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/mentor/mentor-1'));
    expect(result).toHaveLength(1);
  });

  it('throws when ML service is down', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getMentorAlerts('mentor-1')).rejects.toThrow('ML service unavailable');
  });
});

// ─── getStudentAlerts ───

describe('getStudentAlerts', () => {
  it('returns alerts for a student', async () => {
    mockedAxios.get.mockResolvedValue({ data: { data: [SAMPLE_ALERT] } });
    const result = await getStudentAlerts('stu-1');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/student/stu-1'));
    expect(result).toHaveLength(1);
  });

  it('throws when ML service is down', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getStudentAlerts('stu-1')).rejects.toThrow('ML service unavailable');
  });
});

// ─── updateAlertStatus ───

describe('updateAlertStatus', () => {
  it('sends PUT request with status param', async () => {
    mockedAxios.put.mockResolvedValue({ data: { data: { id: 1, alert_status: 'seen' } } });
    const result = await updateAlertStatus(1, 'seen');
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/1/status'),
      null,
      { params: { status: 'seen' } },
    );
    expect(result).toEqual({ id: 1, alert_status: 'seen' });
  });

  it('throws when ML service is down', async () => {
    mockedAxios.put.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(updateAlertStatus(1, 'seen')).rejects.toThrow('ML service unavailable');
  });
});

// ─── recordAlertOutcome ───

describe('recordAlertOutcome', () => {
  const outcomeData = {
    mentor_response: 'acted',
    was_recommendation_followed: true,
    response_time_hours: 2.5,
  };

  it('sends POST request with outcome params', async () => {
    mockedAxios.post.mockResolvedValue({ data: { data: { id: 1 } } });
    await recordAlertOutcome(1, outcomeData);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/1/outcome'),
      null,
      { params: outcomeData },
    );
  });

  it('throws when ML service is down', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(recordAlertOutcome(1, outcomeData)).rejects.toThrow('ML service unavailable');
  });
});

// ─── getAlertStats ───

describe('getAlertStats', () => {
  it('returns alert statistics', async () => {
    const stats = {
      total_alerts: 50, critical_count: 10, high_count: 20, moderate_count: 20,
      avg_response_time_hours: 4.5, acted_rate: 0.75, recommendation_follow_rate: 0.6,
    };
    mockedAxios.get.mockResolvedValue({ data: stats });

    const result = await getAlertStats();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/stats'));
    expect(result.total_alerts).toBe(50);
  });

  it('throws when ML service is down', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getAlertStats()).rejects.toThrow('ML service unavailable');
  });
});
