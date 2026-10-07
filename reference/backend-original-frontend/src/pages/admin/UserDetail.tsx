import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getUser,
  getRoles,
  updateUser,
  changeUserRole,
  changeUserStatus,
  recoverUserAccount,
  type UserDetail as UserDetailType,
  type Role,
} from '../../services/users.service';

type Tab = 'details' | 'role' | 'actions';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetailType | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tab, setTab] = useState<Tab>('details');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editYear, setEditYear] = useState('');
  const [saving, setSaving] = useState(false);

  // Role change
  const [newRoleId, setNewRoleId] = useState('');
  const [roleChanging, setRoleChanging] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getUser(id),
      getRoles(),
    ]).then(([u, r]) => {
      setUser(u);
      populateEditFields(u);
      setRoles(r);
      setNewRoleId(u.role.id);
    }).catch((err) => {
      setError(err.response?.data?.error || 'Failed to load user.');
    }).finally(() => setLoading(false));
  }, [id]);

  function populateEditFields(u: UserDetailType) {
    setEditName(u.name);
    setEditPhone(u.phone ?? '');
    setEditDept(u.department ?? '');
    setEditYear(u.year != null ? String(u.year) : '');
  }

  function flash(msg: string) {
    setSuccessMsg(msg);
    setError('');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function handleSaveDetails() {
    if (!id || !user) return;
    setSaving(true);
    setError('');
    try {
      const patch: Record<string, unknown> = {};
      if (editName.trim() !== user.name) patch.name = editName.trim();
      if ((editPhone.trim() || null) !== user.phone) patch.phone = editPhone.trim() || null;
      if ((editDept.trim() || null) !== user.department) patch.department = editDept.trim() || null;
      const yr = editYear.trim() ? parseInt(editYear, 10) : null;
      if (yr !== user.year) patch.year = yr;

      if (Object.keys(patch).length === 0) { setSaving(false); return; }

      const updated = await updateUser(id, patch);
      setUser(updated);
      populateEditFields(updated);
      flash('Profile updated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange() {
    if (!id || !user || newRoleId === user.role.id) return;
    setRoleChanging(true);
    setError('');
    try {
      const result = await changeUserRole(id, newRoleId);
      flash(result.message);
      const refreshed = await getUser(id);
      setUser(refreshed);
      setNewRoleId(refreshed.role.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change role.');
    } finally {
      setRoleChanging(false);
    }
  }

  async function handleToggleStatus() {
    if (!id || !user) return;
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError('');
    try {
      const result = await changeUserStatus(id, nextStatus);
      flash(result.message);
      const refreshed = await getUser(id);
      setUser(refreshed);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change status.');
    }
  }

  async function handleRecover() {
    if (!id) return;
    setError('');
    try {
      const result = await recoverUserAccount(id);
      flash(result.message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate recovery.');
    }
  }

  if (loading) return <p className="text-gray-500 mt-8 text-center">Loading user…</p>;
  if (!user) return <p className="text-red-600 mt-8 text-center">{error || 'User not found.'}</p>;

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-red-100 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Profile' },
    { key: 'role', label: 'Role' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4">
      <Link to="/admin/users" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Users</Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[user.status] || 'bg-gray-100'}`}>
          {user.status}
        </span>
        <span className="text-sm text-gray-500">{user.role.name}</span>
      </div>

      {successMsg && (
        <p className="bg-green-50 border border-green-200 text-green-800 rounded px-4 py-2 mb-4">{successMsg}</p>
      )}
      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4">{error}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'details' && (
        <div className="bg-white border rounded p-6 space-y-4">
          <ReadonlyField label="Email" value={user.email} />
          <ReadonlyField label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="Optional"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Role Tab */}
      {tab === 'role' && (
        <div className="bg-white border rounded p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Current role: <strong>{user.role.name}</strong>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Role</label>
            <select
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRoleChange}
            disabled={roleChanging || newRoleId === user.role.id}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {roleChanging ? 'Changing…' : 'Change Role'}
          </button>
        </div>
      )}

      {/* Actions Tab */}
      {tab === 'actions' && (
        <div className="bg-white border rounded p-6 space-y-6">
          <div>
            <h3 className="font-medium mb-2">
              {user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {user.status === 'ACTIVE'
                ? 'Deactivating will revoke all sessions and prevent login.'
                : 'Activating will allow this user to log in.'}
            </p>
            <button
              onClick={handleToggleStatus}
              className={`px-4 py-2 rounded text-sm text-white ${
                user.status === 'ACTIVE' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
          </div>

          <hr />

          <div>
            <h3 className="font-medium mb-2">Account Recovery</h3>
            <p className="text-sm text-gray-600 mb-3">
              Sends a new activation or password reset link to the user's email.
            </p>
            <button
              onClick={handleRecover}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 text-sm"
            >
              Initiate Recovery
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
