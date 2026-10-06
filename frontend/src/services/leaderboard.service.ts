// src/services/leaderboard.service.ts
import api from './api';
import { LeaderboardResponse } from '../types';

export async function getBatchLeaderboard(batchId: string, week?: string): Promise<LeaderboardResponse> {
  const params: Record<string, string> = {};
  if (week) params.week = week;
  const res = await api.get(`/api/leaderboard/batch/${batchId}`, { params });
  return res.data.data;
}
