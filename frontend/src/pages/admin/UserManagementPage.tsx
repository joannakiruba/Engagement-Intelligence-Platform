// src/pages/admin/UserManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getUsers,
  createUser,
  changeUserRole,
  changeUserStatus,
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

  const canCreate = hasPermission('users:create');
  const canChangeRole = hasPermission('users:change_role');
  const canActivate = hasPermission('users:activate');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsers();
      const list = Array.isArray(res) ? res : (res as any).users ?? [];
      setUsers(list);
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
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-purple-900 font-semibold text-xs hover:bg-purple-50 shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Provision New User
          </button>
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
                {(canChangeRole || canActivate) && <th className="px-4 py-3 text-right">Actions</th>}
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
                  {(canChangeRole || canActivate) && (
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
                        {canActivate && (
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
    </div>
  );
};
