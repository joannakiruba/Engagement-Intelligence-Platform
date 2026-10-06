// src/pages/tasks/TaskDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTask, updateTaskProgress, setTaskMarks, toggleInterested } from '../../services/tasks.service';
import { Task, TaskSubmission } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  CheckSquare,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Award,
  Send,
} from 'lucide-react';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);

  // Student progress form
  const [myProgress, setMyProgress] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'ALMOST_COMPLETED' | 'COMPLETED'>('IN_PROGRESS');
  const [isInterested, setIsInterested] = useState(true);
  const [notes, setNotes] = useState('');
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Trainer grading state
  const [gradingStudentId, setGradingStudentId] = useState<string | null>(null);
  const [marksInput, setMarksInput] = useState<number>(0);
  const [gradingSaving, setGradingSaving] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const canGrade = hasPermission('tasks:grade:batch') || hasPermission('tasks:grade:any');

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getTask(id);
      setTask(res);

      if (isStudent && res.submissions) {
        const mySub = res.submissions.find((s) => s.studentId === user?.id);
        if (mySub) {
          setMyProgress(mySub.progress);
          setIsInterested(mySub.isInterested);
          setNotes(mySub.studentNotes || '');
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSubmittingProgress(true);
      await updateTaskProgress(id, {
        progress: myProgress,
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingProgress(false);
    }
  };

  const handleSaveMarks = async (studentId: string) => {
    if (!id) return;
    try {
      setGradingSaving(true);
      await setTaskMarks(id, studentId, marksInput);
      setGradingStudentId(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setGradingSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading task submission details..." />;
  }

  if (error || !task) {
    return <ErrorState message={error || 'Task not found'} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Tasks
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {task.isMandatory && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                Mandatory
              </span>
            )}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {task.deadlineType} Deadline
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{task.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Max Marks: <strong>{task.maxMarks || 50}</strong>
            {task.deadline && ` • Deadline: ${new Date(task.deadline).toLocaleDateString()}`}
          </p>
        </div>

        {task.description && (
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </div>
        )}

        {/* Student View: Update Submission Progress */}
        {isStudent && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              My Submission Progress
            </h3>

            <form onSubmit={handleUpdateProgress} className="space-y-3.5 max-w-lg text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={myProgress}
                  onChange={(e: any) => setMyProgress(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold"
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress (Working on milestones)</option>
                  <option value="COMPLETED">Completed (Finished &amp; Ready for Review)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Submission Notes / Repository Link</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Paste GitHub repository, deployment link, or progress summary..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="interested"
                  checked={isInterested}
                  onChange={(e) => setIsInterested(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="interested" className="text-slate-700 font-medium">
                  I am interested in advanced placement follow-ups for this challenge
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingProgress}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" /> Save Submission Status
              </button>
            </form>
          </div>
        )}

        {/* Trainer / Admin View: Submissions & Grading Table */}
        {!isStudent && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Student Submissions &amp; Grading ({task.submissions?.length || 0})
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Progress</th>
                    <th className="px-4 py-2.5">Submitted Notes</th>
                    <th className="px-4 py-2.5">Marks Awarded</th>
                    {canGrade && <th className="px-4 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!task.submissions || task.submissions.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No submissions recorded yet for this task.
                      </td>
                    </tr>
                  ) : (
                    task.submissions.map((sub: TaskSubmission) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {sub.student?.name || sub.studentId}
                          <span className="block text-[11px] font-normal text-slate-400">{sub.student?.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sub.progress} type="progress" />
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {sub.studentNotes || '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {sub.marksAwarded !== undefined ? (
                            <span className="text-emerald-700">{sub.marksAwarded} / {task.maxMarks || 50}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Ungraded</span>
                          )}
                        </td>
                        {canGrade && (
                          <td className="px-4 py-3 text-right">
                            {gradingStudentId === sub.studentId ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={task.maxMarks || 100}
                                  value={marksInput}
                                  onChange={(e) => setMarksInput(Number(e.target.value))}
                                  className="w-16 p-1 text-xs border border-slate-300 rounded font-semibold text-center"
                                />
                                <button
                                  onClick={() => handleSaveMarks(sub.studentId)}
                                  disabled={gradingSaving}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setGradingStudentId(null)}
                                  className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setGradingStudentId(sub.studentId);
                                  setMarksInput(sub.marksAwarded || 0);
                                }}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                              >
                                {sub.marksAwarded !== undefined ? 'Update Marks' : 'Grade'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
