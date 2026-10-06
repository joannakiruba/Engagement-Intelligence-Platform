import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getUsers,
  getRoles,
  type UserSummary,
  type Role,
  type UserListParams,
} from '../../services/users.service';

const STATUS_OPTIONS = ['', 'ACTIVE', 'INACTIVE', 'PENDING'] as const;
const PAGE_SIZE = 20;

export default function UserList() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    getRoles().then(setRoles).catch(() => {});
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, roleId, status]);

  async function loadUsers(resetPage = false) {
    setLoading(true);
    setError('');
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    const params: UserListParams = { page: p, limit: PAGE_SIZE };
    if (search.trim()) params.search = search.trim();
    if (roleId) params.roleId = roleId;
    if (status) params.status = status;
    if (department.trim()) params.department = department.trim();

    try {
      const result = await getUsers(params);
      setUsers(result.users);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    loadUsers(true);
  }

  function clearFilters() {
    setSearch('');
    setRoleId('');
    setStatus('');
    setDepartment('');
    setPage(1);
    setTimeout(() => loadUsers(true), 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[s] || 'bg-gray-100 text-gray-700'}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/users/create"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Create User
          </Link>
          <Link
            to="/admin/users/bulk-upload"
            className="border border-blue-600 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 text-sm"
          >
            Bulk CSV Upload
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white border rounded p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        />
        <select
          value={roleId}
          onChange={(e) => { setRoleId(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Department…"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
            Search
          </button>
          <button type="button" onClick={clearFilters} className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">
            Clear
          </button>
        </div>
      </form>

      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4">{error}</p>
      )}

      {/* Table */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${u.id}`} className="text-blue-600 hover:underline font-medium">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">{u.role.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.department || '—'}</td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 border rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
