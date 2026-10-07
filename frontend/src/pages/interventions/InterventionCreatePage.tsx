// src/pages/interventions/InterventionCreatePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createIntervention, getInterventionAlerts } from '../../services/interventions.service';
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

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [alertId, setAlertId] = useState('');
  const [causeCode, setCauseCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInterventionAlerts().then(rows => {
      const eligible = preselectedStudentId ? rows.filter(a => a.student_id === preselectedStudentId) : rows;
      setAlerts(eligible);
    }).catch(err => setError(err?.response?.data?.error || 'Could not load mentor alerts')).finally(() => setLoadingStudents(false));
  }, [preselectedStudentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertId || !causeCode || !title.trim() || !description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await createIntervention({
        alertId: Number(alertId),
        causeCode,
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
            <label className="block font-semibold mb-1">Mentor alert *</label>
            <select className="w-full border rounded p-2" required value={alertId} onChange={e => { setAlertId(e.target.value); setCauseCode(''); }}>
              <option value="">Select an alert</option>
              {alerts.map(a => <option key={a.id} value={a.id}>{a.student_name || a.student_id} — {a.risk_category || 'Alert'} #{a.id}</option>)}
            </select>
            <label className="block font-semibold mt-3 mb-1">Recorded cause *</label>
            <select className="w-full border rounded p-2" required value={causeCode} onChange={e => setCauseCode(e.target.value)}>
              <option value="">Select a cause</option>
              {(alerts.find(a => String(a.id) === alertId)?.causes || []).map((c: any) => <option key={c.cause_code} value={c.cause_code}>{c.cause_code.replaceAll('_', ' ')}</option>)}
            </select>
            {!alerts.length && <p className="mt-2 text-slate-500">No eligible alerts are available. An intervention must be linked to an assigned student's recorded alert and cause.</p>}
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
