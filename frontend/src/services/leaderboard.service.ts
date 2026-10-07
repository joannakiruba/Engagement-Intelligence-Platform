// src/services/leaderboard.service.ts
import api from './api';
import { LeaderboardResponse } from '../types';

export async function getBatchLeaderboard(batchId: string, week?: string): Promise<LeaderboardResponse> {
  const params: Record<string, string> = {};
  if (week) params.week = week;
  const res = await api.get(`/api/leaderboard/batch/${batchId}`, { params });
  const d = res.data.data;
  return { batch: d.batch, week: d.week.label, totalEvaluated: d.totalStudents, contestDataWarning: d.contestDataAvailable ? null : 'No contest data available for this period.', leaderboard: d.rankings.map((r: any) => ({ rank: r.rank, student: { id: r.studentId, name: r.studentName, email: '' }, attendanceRate: r.attendanceScore, assessmentAverage: r.assessmentScore, contestScore: r.contestScore, finalScore: r.finalScore })) };
}
