// src/pages/mentor/MentorAssignmentsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getMentorAssignments,
  createMentorAssignment,
  deleteMentorAssignment,
} from '../../services/mentor.service';
import { getUsers } from '../../services/users.service';
import { MentorAssignment, User } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  UserCheck,
  PlusCircle,
  Trash2,
  Search,
} from 'lucide-react';

export const MentorAssignmentsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<MentorAssignment[]>([]);
  const [search, setSearch] = useState('');

  // Add Pairing Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [mentors, setMentors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const canCreate = hasPermission('mentor_assignments:create');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMentorAssignments();
      setAssignments(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = async () => {
    try {
      setModalOpen(true);
      setModalError(null);
      const [allMentors, allStudents] = await Promise.all([
        getUsers({ role: 'MENTOR' }),
        getUsers({ role: 'STUDENT' }),
      ]);
      setMentors(allMentors);
      setStudents(allStudents);
      if (allMentors.length > 0) setSelectedMentor(allMentors[0].id);
      if (allStudents.length > 0) setSelectedStudent(allStudents[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentor || !selectedStudent) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await createMentorAssignment(selectedMentor, selectedStudent);
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.response?.data?.error || err.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this mentor-student pairing?')) return;
    try {
      await deleteMentorAssignment(id);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <LoadingState message="Loading mentor-student caseload pairings..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const filtered = assignments.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.mentor?.name?.toLowerCase().includes(q) ||
      a.student?.name?.toLowerCase().includes(q) ||
      a.student?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <UserCheck className="w-3.5 h-3.5" />
            Caseload &amp; Roster Management
          </div>
          <h1 className="text-2xl font-black tracking-tight">Mentor Assignments</h1>
          <p className="text-teal-100 text-sm mt-1 max-w-2xl">
            Configure student-mentor pairings. Mentors receive disengagement risk alerts and have authorized
            access to view attendance, marks, and launch interventions for their assigned mentees.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-teal-900 font-semibold text-xs hover:bg-teal-50 shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Add Mentor Pairing
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mentor or student..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filtered.length} Active Pairings
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">Assigned Mentor</th>
                <th className="px-4 py-3">Student Mentee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned On</th>
                {canCreate && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {a.mentor?.name || a.mentorId}
                    <span className="block text-[11px] font-normal text-slate-400">{a.mentor?.email}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {a.student?.name || a.studentId}
                    <span className="block text-[11px] font-normal text-slate-400">{a.student?.email}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.student?.department || 'Computer Science'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(a.assignedAt).toLocaleDateString()}
                  </td>
                  {canCreate && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Pairing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Mentor-Student Pairing"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {modalError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Mentor</label>
            <select
              value={selectedMentor}
              onChange={(e) => setSelectedMentor(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            >
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email} • {s.department || 'CS'})
                </option>
              ))}
            </select>
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
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs"
            >
              Save Pairing
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
