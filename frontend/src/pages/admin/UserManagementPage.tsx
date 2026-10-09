// src/pages/admin/UserManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getUsers,
  createUser,
  changeUserRole,
  changeUserStatus,
  bulkUploadCSV,
  resendActivation,
} from '../../services/users.service';
import { User, RoleName } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  ShieldAlert,
  PlusCircle,
  Search,
  UserCheck,
  UserX,
  Edit2,
  Check,
  Mail,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<RoleName>('STUDENT');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newYear, setNewYear] = useState<number>(3);
  const [newPhone, setNewPhone] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Change Role Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<RoleName>('STUDENT');
  const [submittingRole, setSubmittingRole] = useState(false);

  // Bulk CSV Upload Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [submittingCSV, setSubmittingCSV] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    created: Array<{ row: number; email: string; userId: string }>;
    rejected: Array<{ row: number; email?: string; reason: string }>;
  } | null>(null);

  const canCreate = hasPermission('users:create');
  const canChangeRole = hasPermission('users:change_role');
  const canActivate = hasPermission('users:activate');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsers();
      setUsers(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    try {
      setSubmittingUser(true);
      await createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        department: newDept,
        year: newRole === 'STUDENT' ? newYear : undefined,
        phone: newPhone,
      });
      setCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    try {
      setSubmittingRole(true);
      await changeUserRole(targetUser.id, selectedNewRole);
      setRoleModalOpen(false);
      setTargetUser(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await changeUserStatus(user.id, nextStatus);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;
    try {
      setSubmittingCSV(true);
      const result = await bulkUploadCSV(csvContent);
      setCsvResult(result);
      if (result.created.length > 0) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setSubmittingCSV(false);
    }
  };

  const handleResendActivation = async (user: User) => {
    if (user.status !== 'PENDING') return;
    if (!confirm(`Resend activation email to ${user.email}?`)) return;
    try {
      await resendActivation(user.email);
      alert('Activation email has been queued for delivery.');
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  if (loading) {
    return <LoadingState message="Loading platform users and security directory..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            Module 3 User &amp; Role Management
          </div>
          <h1 className="text-2xl font-black tracking-tight">Institutional User Directory</h1>
          <p className="text-purple-100 text-sm mt-1 max-w-2xl">
            Control RBAC personas, assign roles, manage active/inactive statuses, and audit accounts
            across students, trainers, faculty, mentors, and administrators.
          </p>
        </div>

        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-purple-900 font-semibold text-xs hover:bg-purple-50 shadow-sm transition-all shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              Provision New User
            </button>
            <button
              onClick={() => {
                setCsvModalOpen(true);
                setCsvContent('');
                setCsvResult(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 shadow-sm transition-all shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              Bulk CSV Upload
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, department..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'STUDENT', 'TRAINER', 'FACULTY', 'MENTOR', 'COORDINATOR', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === r
                  ? 'bg-purple-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Showing {filtered.length} Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                {(canChangeRole || canActivate || canCreate) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {u.name}
                    <span className="block text-[11px] font-normal text-slate-400">{u.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.role} type="role" />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.department || '—'}
                    {u.year ? ` • Year ${u.year}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} type="progress" />
                  </td>
                  {(canChangeRole || canActivate || canCreate) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canChangeRole && (
                          <button
                            onClick={() => {
                              setTargetUser(u);
                              setSelectedNewRole(u.role);
                              setRoleModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                            title="Change Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canActivate && u.status !== 'PENDING' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg border ${
                              u.status === 'ACTIVE'
                                ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {canCreate && u.status === 'PENDING' && (
                          <button
                            onClick={() => handleResendActivation(u)}
                            className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
                            title="Resend Activation Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Provision New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sumanth Narayanan"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="sumanth@hope.dev"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role *</label>
              <select
                value={newRole}
                onChange={(e: any) => setNewRole(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold"
              >
                <option value="STUDENT">STUDENT</option>
                <option value="TRAINER">TRAINER</option>
                <option value="FACULTY">FACULTY</option>
                <option value="MENTOR">MENTOR</option>
                <option value="COORDINATOR">COORDINATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              >
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="AI & Data Science">AI & Data Science</option>
                <option value="Administration">Administration</option>
              </select>
            </div>
          </div>

          {newRole === 'STUDENT' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Academic Year</label>
              <input
                type="number"
                min="1"
                max="4"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+1-555-0199"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingUser}
              className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow-xs"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={`Change Role — ${targetUser?.name}`}
      >
        <form onSubmit={handleChangeRole} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Select the new system role for <strong>{targetUser?.email}</strong>. This updates their access rights across all modules immediately.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select New Role</label>
            <select
              value={selectedNewRole}
              onChange={(e: any) => setSelectedNewRole(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold"
            >
              <option value="STUDENT">STUDENT</option>
              <option value="TRAINER">TRAINER</option>
              <option value="FACULTY">FACULTY</option>
              <option value="MENTOR">MENTOR</option>
              <option value="COORDINATOR">COORDINATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRoleModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingRole}
              className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" /> Confirm Role Change
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Upload Modal */}
      <Modal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Bulk CSV Upload"
      >
        <form onSubmit={handleBulkCSVUpload} className="space-y-4 text-xs">
          <div>
            <p className="text-slate-600 mb-3">
              Upload a CSV file with the following format (header row required):
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[10px] mb-3">
              name,email,department,year<br />
              John Doe,john@example.com,Computer Science,3<br />
              Jane Smith,jane@example.com,Information Technology,2
            </div>
            <p className="text-slate-500 text-[11px] mb-3">
              • Users will be created with STUDENT role and PENDING status<br />
              • Activation emails will be queued for each user<br />
              • Department and year are optional
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">CSV Content</label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste CSV content here or upload a file..."
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-mono"
              rows={8}
            />
          </div>

          {csvResult && (
            <div className="space-y-2">
              {csvResult.created.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                  <p className="font-semibold text-emerald-800 mb-1">
                    ✓ Created {csvResult.created.length} user{csvResult.created.length !== 1 ? 's' : ''}
                  </p>
                  <div className="text-emerald-700 text-[11px] max-h-32 overflow-y-auto">
                    {csvResult.created.map((c) => (
                      <div key={c.row}>Row {c.row}: {c.email}</div>
                    ))}
                  </div>
                </div>
              )}
              {csvResult.rejected.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg">
                  <p className="font-semibold text-rose-800 mb-1">
                    ✗ Rejected {csvResult.rejected.length} row{csvResult.rejected.length !== 1 ? 's' : ''}
                  </p>
                  <div className="text-rose-700 text-[11px] max-h-32 overflow-y-auto">
                    {csvResult.rejected.map((r, i) => (
                      <div key={i}>Row {r.row}: {r.reason}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCsvModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submittingCSV || !csvContent.trim()}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50"
            >
              {submittingCSV ? 'Processing...' : 'Upload CSV'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
