// src/pages/tasks/TaskListPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTasks, getMyTasks, createTask } from '../../services/tasks.service';
import { getBatches } from '../../services/batches.service';
import { Task, Batch } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  CheckSquare,
  PlusCircle,
  Clock,
  ArrowRight,
  Send,
} from 'lucide-react';

export const TaskListPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);

  // Create Task Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(50);
  const [deadline, setDeadline] = useState('');
  const [deadlineType, setDeadlineType] = useState<'FIXED' | 'TENTATIVE' | 'TBD' | 'NONE'>('FIXED');
  const [isMandatory, setIsMandatory] = useState(true);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const canCreate = hasPermission('tasks:create:batch') || hasPermission('tasks:create:any');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (isStudent) {
        const res = await getMyTasks();
        setMyTasks(res);
      } else {
        const res = await getTasks();
        setTasks(res);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleOpenCreate = async () => {
    try {
      setModalOpen(true);
      const bList = await getBatches();
      setBatches(bList);
      if (bList.length > 0) setSelectedBatchIds([bList[0].id]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setSubmitting(true);
      await createTask({
        title: title.trim(),
        description: description.trim(),
        maxMarks,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        deadlineType,
        isMandatory,
        batchIds: selectedBatchIds,
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading tasks and programming assignments..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <CheckSquare className="w-3.5 h-3.5" />
            Task Assignments Module
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {isStudent ? 'My Assigned Tasks & Milestones' : 'Batch Task Assignments'}
          </h1>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Structured homework, coding milestones, and mandatory challenge deadlines.
            Review submissions, track progress, and grade student submissions.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-semibold text-xs hover:bg-blue-50 shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Create New Task
          </button>
        )}
      </div>

      {/* Content */}
      {isStudent ? (
        <div className="space-y-3">
          {myTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              No tasks currently assigned to your cohort.
            </div>
          ) : (
            myTasks.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{item.task.title}</h4>
                    {item.task.isMandatory && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        Mandatory
                      </span>
                    )}
                    <StatusBadge status={item.submission.progress} type="progress" />
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.task.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                    {item.task.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Deadline: {new Date(item.task.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {item.submission.marksAwarded !== undefined && (
                      <span className="font-bold text-emerald-700">
                        Marks: {item.submission.marksAwarded} / {item.task.maxMarks ?? 'N/A'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <Link
                    to={`/tasks/${item.task.id}`}
                    className="px-3.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    Update Progress <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No tasks created yet.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                      {task.isMandatory && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Mandatory
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {task.deadlineType} Deadline
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      <span>Max Marks: <strong>{task.maxMarks ?? 'N/A'}</strong></span>
                      {task.deadline && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>Submissions: <strong>{task.submissionCount || 0}</strong></span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      Submissions &amp; Grading <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Cohort Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full-Stack Mini Project Milestone 1"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description &amp; Requirements</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed instructions..."
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Marks</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deadline Type</label>
              <select
                value={deadlineType}
                onChange={(e: any) => setDeadlineType(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              >
                <option value="FIXED">FIXED (Confirmed deadline)</option>
                <option value="TENTATIVE">TENTATIVE (May change)</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deadline Date</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mand"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <label htmlFor="mand" className="text-slate-700 font-medium">
              Mandatory submission for placement tracking
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
            >
              <Send className="w-3.5 h-3.5 inline mr-1" /> Create Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
