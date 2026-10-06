import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUser, getRoles, type Role } from '../../services/users.service';

export default function UserCreate() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    getRoles().then((r) => {
      setRoles(r);
      const student = r.find((role) => role.name === 'STUDENT');
      if (student) setRoleId(student.id);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const user = await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        roleId: roleId || undefined,
        department: department.trim() || undefined,
        year: year.trim() ? parseInt(year, 10) : undefined,
      });
      navigate(`/admin/users/${user.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-6 px-4">
      <Link to="/admin/users" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Users</Link>
      <h1 className="text-2xl font-bold mb-6">Create User</h1>

      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="bg-white border rounded p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            id="name"
            type="text"
            required
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            id="role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">Default (STUDENT)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              id="department"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          The user will be created with PENDING status and receive an activation email.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Creating…' : 'Create User'}
          </button>
          <Link
            to="/admin/users"
            className="border px-4 py-2 rounded hover:bg-gray-50 text-sm inline-flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
