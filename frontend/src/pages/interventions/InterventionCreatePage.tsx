// src/pages/interventions/InterventionCreatePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createIntervention } from '../../services/interventions.service';
import { getMentorAssignments } from '../../services/mentor.service';
import { getUsers } from '../../services/users.service';
import { User, MentorAssignment } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react';

export const InterventionCreatePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedStudentId = searchParams.get('studentId') || '';

  const [students, setStudents] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [studentId, setStudentId] = useState(preselectedStudentId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingStudents(true);
        if (user?.role === 'MENTOR') {
          const assignments = await getMentorAssignments({ mentorId: user.id });
          const assignedStudents = assignments
            .map((a: MentorAssignment) => a.student)
            .filter(Boolean) as User[];
          setStudents(assignedStudents);
          if (assignedStudents.length > 0 && !studentId) {
            setStudentId(assignedStudents[0].id);
          }
        } else {
          const allStudents = await getUsers({ role: 'STUDENT' });
          setStudents(allStudents);
          if (allStudents.length > 0 && !studentId) {
            setStudentId(allStudents[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStudents(false);
      }
    };
    load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !title.trim() || !description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await createIntervention({
        studentId,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      navigate(`/interventions/${res.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to create intervention.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStudents) {
    return <LoadingState message="Fetching eligible student roster..." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/interventions"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Interventions
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-teal-600" />
            Create Student Intervention
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Establish a formal recovery plan for students facing disengagement or performance decline.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Student *</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email} • {s.department || 'CS'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Intervention Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2-Week Attendance Catch-up &amp; React Lab Tutoring"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Completion Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Recovery Plan &amp; Action Items *</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify milestones: morning attendance accountability, missed quizzes to retake, 1:1 check-in schedule..."
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <Link
              to="/interventions"
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" /> Launch Intervention
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
