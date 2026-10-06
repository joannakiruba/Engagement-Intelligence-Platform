// src/pages/leaderboard/LeaderboardPage.tsx
import React, { useState, useEffect } from 'react';
import { getBatchLeaderboard } from '../../services/leaderboard.service';
import { getBatches } from '../../services/batches.service';
import { Batch, LeaderboardResponse, LeaderboardRankItem } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../services/api';
import {
  Trophy,
  Medal,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Award,
} from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('2026-10-05');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  // 1. Load Batches
  useEffect(() => {
    getBatches()
      .then((res) => {
        setBatches(res);
        if (res.length > 0 && !selectedBatchId) {
          setSelectedBatchId(res[0].id);
        }
      })
      .catch((err) => {
        setError(getErrorMessage(err));
      });
  }, []);

  // 2. Load Leaderboard for selected batch and week
  const fetchLeaderboard = async (batchId: string, week: string) => {
    if (!batchId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getBatchLeaderboard(batchId, week);
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchLeaderboard(selectedBatchId, selectedWeek);
    }
  }, [selectedBatchId, selectedWeek]);

  const top3 = data?.leaderboard.slice(0, 3) || [];
  const top10 = data?.leaderboard || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Module 18 Weekly High-Achiever Recognition
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-200" />
            Weekly High-Achiever Leaderboard
          </h1>
          <p className="text-amber-100 text-sm mt-1 max-w-2xl">
            Celebrating academic excellence and relentless consistency across cohorts.
            Evaluated every Monday based on attendance (30%), assessment mastery (50%), and contest performance (20%).
          </p>
        </div>

        {/* Formula Explainer Pill */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-xs text-amber-50 shrink-0">
          <div className="font-bold text-white mb-1">Scoring Weight Distribution</div>
          <div className="space-y-0.5 text-[11px]">
            <div>• Attendance Consistency: <strong>30%</strong></div>
            <div>• Average Assessment Score: <strong>50%</strong></div>
            <div>• Contest &amp; Event Proofs: <strong>20%</strong></div>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Select Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.department})
                </option>
              ))}
            </select>
          </div>

          {/* Week Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Evaluation Week
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchLeaderboard(selectedBatchId, selectedWeek)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Standings
        </button>
      </div>

      {/* Contest Data Warning Notice */}
      {data?.contestDataWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-bold text-amber-900">Contest Data Notice: </span>
            {data.contestDataWarning}
          </div>
        </div>
      )}

      {/* Main Content: Loading, Error, or Data */}
      {loading ? (
        <LoadingState message="Calculating weekly performance metrics &amp; leaderboard rankings..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchLeaderboard(selectedBatchId, selectedWeek)} />
      ) : top10.length === 0 ? (
        <EmptyState
          title="No Leaderboard Data"
          description="No students or performance records were found for the selected batch and week."
        />
      ) : (
        <>
          {/* Top-3 Podium Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
            {/* Rank 2 - Silver (Left) */}
            {top3[1] && (
              <div className="order-2 md:order-1 bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-slate-200 to-slate-400 opacity-20 rounded-bl-full" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                      <Medal className="w-4 h-4 text-slate-500" />
                      Rank #2 • Silver
                    </span>
                    <span className="text-2xl font-black text-slate-800">
                      {top3[1].finalScore}
                      <span className="text-xs text-slate-500 font-medium">/100</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center font-bold text-slate-700 text-lg">
                      {top3[1].student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{top3[1].student.name}</h3>
                      <p className="text-xs text-slate-500">{top3[1].student.department}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Attendance (30%)</span>
                    <strong className="text-slate-800">{top3[1].attendanceRate}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Assess (50%)</span>
                    <strong className="text-slate-800">{top3[1].assessmentAverage}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Contest (20%)</span>
                    <strong className="text-slate-800">{top3[1].contestScore}%</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1 - Gold (Center, Elevated) */}
            {top3[0] && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50/70 via-white to-white rounded-2xl border-2 border-amber-400 p-6 shadow-md relative overflow-hidden flex flex-col justify-between -mt-2">
                <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-amber-300 to-yellow-500 opacity-20 rounded-bl-full" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-xs">
                      <Trophy className="w-4 h-4 text-white" />
                      Rank #1 • Champion
                    </span>
                    <span className="text-3xl font-black text-amber-950">
                      {top3[0].finalScore}
                      <span className="text-xs text-amber-700 font-bold">/100</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 mt-5">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-2 border-amber-400 flex items-center justify-center font-black text-amber-950 text-xl shadow-xs">
                      {top3[0].student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg">{top3[0].student.name}</h3>
                      <p className="text-xs text-slate-500">{top3[0].student.department}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Top Performer
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-amber-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/40">
                    <span className="text-[10px] text-amber-800 block uppercase font-medium">Attendance (30%)</span>
                    <strong className="text-amber-950 text-sm">{top3[0].attendanceRate}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/40">
                    <span className="text-[10px] text-amber-800 block uppercase font-medium">Assess (50%)</span>
                    <strong className="text-amber-950 text-sm">{top3[0].assessmentAverage}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/40">
                    <span className="text-[10px] text-amber-800 block uppercase font-medium">Contest (20%)</span>
                    <strong className="text-amber-950 text-sm">{top3[0].contestScore}%</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 3 - Bronze (Right) */}
            {top3[2] && (
              <div className="order-3 bg-white rounded-2xl border-2 border-amber-700/30 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-600 to-amber-900 opacity-15 rounded-bl-full" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100/70 text-amber-900 border border-amber-700/30">
                      <Medal className="w-4 h-4 text-amber-700" />
                      Rank #3 • Bronze
                    </span>
                    <span className="text-2xl font-black text-slate-800">
                      {top3[2].finalScore}
                      <span className="text-xs text-slate-500 font-medium">/100</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-700/40 flex items-center justify-center font-bold text-amber-900 text-lg">
                      {top3[2].student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{top3[2].student.name}</h3>
                      <p className="text-xs text-slate-500">{top3[2].student.department}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Attendance (30%)</span>
                    <strong className="text-slate-800">{top3[2].attendanceRate}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Assess (50%)</span>
                    <strong className="text-slate-800">{top3[2].assessmentAverage}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-400 block uppercase">Contest (20%)</span>
                    <strong className="text-slate-800">{top3[2].contestScore}%</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top 10 Ranked Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs mt-6">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Top 10 High Achievers Ranking</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Batch: {data?.batch?.name || 'Selected'} • {data?.totalEvaluated ?? 0} students evaluated for week of {data?.week || ''}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-16">Rank</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Attendance (30%)</th>
                    <th className="px-4 py-3">Assessment (50%)</th>
                    <th className="px-4 py-3">Contest (20%)</th>
                    <th className="px-4 py-3 text-right">Final Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {top10.map((item: LeaderboardRankItem) => {
                    let rankBadge = (
                      <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center">
                        #{item.rank}
                      </span>
                    );

                    if (item.rank === 1) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 text-xs font-black inline-flex items-center justify-center shadow-xs">
                          🥇
                        </span>
                      );
                    } else if (item.rank === 2) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 text-xs font-black inline-flex items-center justify-center shadow-xs">
                          🥈
                        </span>
                      );
                    } else if (item.rank === 3) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-full bg-amber-700 text-white text-xs font-black inline-flex items-center justify-center shadow-xs">
                          🥉
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={item.student.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          item.rank <= 3 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center">{rankBadge}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.student.name}
                          <span className="block text-xs font-normal text-slate-500">{item.student.email}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.student.department || 'Computer Science'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 w-9">{item.attendanceRate}%</span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${item.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 w-9">{item.assessmentAverage}%</span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${item.assessmentAverage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 w-9">{item.contestScore}%</span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full"
                                style={{ width: `${item.contestScore}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black bg-slate-900 text-white shadow-xs">
                            {item.finalScore} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
