import { useState, useEffect, type FormEvent } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  year: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  role: { id: string; name: string };
}

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await api.get('/users/me');
      const data: ProfileData = res.data.data;
      setProfile(data);
      setEditName(data.name);
      setEditPhone(data.phone ?? '');
      setStatus('idle');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setErrorMsg('Session expired. Please sign in again.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to load profile.');
      }
      setStatus('error');
    }
  }

  function startEdit() {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone ?? '');
    setEditing(true);
    setStatus('idle');
    setErrorMsg('');
  }

  function cancelEdit() {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone ?? '');
    setEditing(false);
    setErrorMsg('');
    if (status === 'saved' || status === 'error') setStatus('idle');
  }

  function hasChanges(): boolean {
    if (!profile) return false;
    const trimmedName = editName.trim();
    const normalizedPhone = editPhone.trim() || null;
    return trimmedName !== profile.name || normalizedPhone !== profile.phone;
  }

  function isValid(): boolean {
    return editName.trim().length > 0;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile || !hasChanges() || !isValid()) return;

    setStatus('saving');
    setErrorMsg('');

    const patch: Record<string, unknown> = {};
    const trimmedName = editName.trim();
    const normalizedPhone = editPhone.trim() || null;
    if (trimmedName !== profile.name) patch.name = trimmedName;
    if (normalizedPhone !== profile.phone) patch.phone = normalizedPhone;

    try {
      const res = await api.patch('/users/me', patch);
      const data: ProfileData = res.data.data;
      setProfile(data);
      setEditName(data.name);
      setEditPhone(data.phone ?? '');
      setEditing(false);
      setStatus('saved');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setErrorMsg('Session expired. Please sign in again.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to save changes.');
      }
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return <p className="text-gray-500 mt-8">Loading profile…</p>;
  }

  if (status === 'error' && !profile) {
    return (
      <div className="mt-8">
        <p role="alert" className="text-red-600 mb-4">{errorMsg}</p>
        <button onClick={loadProfile} className="text-blue-600 underline">Retry</button>
        {errorMsg.includes('Session expired') && (
          <button onClick={logout} className="ml-4 text-blue-600 underline">Sign in</button>
        )}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-lg mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {status === 'saved' && (
        <p role="status" className="bg-green-50 border border-green-200 text-green-800 rounded px-4 py-2 mb-4">
          Profile updated successfully.
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4">
          {errorMsg}
        </p>
      )}

      <div className="bg-white rounded border p-6 space-y-4">
        {/* Read-only fields */}
        <Field label="Email" value={profile.email} />
        <Field label="Role" value={profile.role.name} />
        {profile.department && <Field label="Department" value={profile.department} />}
        {profile.year != null && <Field label="Year" value={String(profile.year)} />}
        <Field label="Status" value={profile.status} />
        <Field label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />

        {/* Editable fields */}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4 pt-4 border-t">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                maxLength={255}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={30}
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty to remove phone number.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={status === 'saving' || !hasChanges() || !isValid()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {status === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={status === 'saving'}
                className="border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-400">
              To change your email, role or other read-only fields, contact an administrator.
            </p>
          </form>
        ) : (
          <>
            <Field label="Full name" value={profile.name} />
            <Field label="Phone" value={profile.phone || '—'} />
            <button
              onClick={startEdit}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Edit profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
