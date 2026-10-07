import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getBatch,
  getRoster,
  addStudent,
  removeStudent,
  assignTrainer,
  removeTrainer,
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  type BatchDetail as BatchDetailType,
  type RosterStudent,
  type SessionItem,
  type BatchTrainer,
} from "../../services/batches.service";
import { getRoles, type Role } from "../../services/users.service";
import { useAuth } from "../../context/AuthContext";
import UserPicker from "../../components/UserPicker";

export default function BatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canManageSessions = user && ["TRAINER", "ADMIN"].includes(user.role);

  const [batch, setBatch] = useState<BatchDetailType | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add student
  const [studentId, setStudentId] = useState("");
  const [studentError, setStudentError] = useState("");

  // Add trainer
  const [trainerId, setTrainerId] = useState("");
  const [trainerError, setTrainerError] = useState("");

  // Remove confirmations
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<string | null>(null);
  const [confirmRemoveTrainer, setConfirmRemoveTrainer] = useState<string | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);

  // Create session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionTrainerId, setSessionTrainerId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionEndTime, setSessionEndTime] = useState("");
  const [sessionError, setSessionError] = useState("");

  // Edit session
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editTrainerId, setEditTrainerId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editError, setEditError] = useState("");

  function roleIdFor(name: string): string | undefined {
    return roles.find((r) => r.name === name)?.id;
  }

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [batchRes, rosterRes, sessionsRes, rolesRes] = await Promise.all([
        getBatch(id),
        getRoster(id),
        getSessions(id),
        roles.length ? Promise.resolve(roles) : getRoles(),
      ]);
      setBatch(batchRes);
      setRoster(rosterRes);
      setSessions(sessionsRes);
      if (!roles.length) setRoles(rolesRes as Role[]);
    } catch {
      setError("Failed to load batch details.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  // --- Student handlers ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setStudentError("");
    try {
      await addStudent(id!, studentId);
      setStudentId("");
      setRoster(await getRoster(id!));
    } catch (err: any) {
      setStudentError(err.response?.data?.error || "Failed to add student");
    }
  };

  const handleRemoveStudent = async (sid: string) => {
    setConfirmRemoveStudent(null);
    setStudentError("");
    try {
      await removeStudent(id!, sid);
      setRoster(await getRoster(id!));
    } catch (err: any) {
      setStudentError(err.response?.data?.error || "Failed to remove student");
    }
  };

  // --- Trainer handlers ---
  const handleAssignTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerId) return;
    setTrainerError("");
    try {
      await assignTrainer(id!, trainerId);
      setTrainerId("");
      setBatch(await getBatch(id!));
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to assign trainer");
    }
  };

  const handleRemoveTrainer = async (tid: string) => {
    setConfirmRemoveTrainer(null);
    setTrainerError("");
    try {
      await removeTrainer(id!, tid);
      setBatch(await getBatch(id!));
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to remove trainer");
    }
  };

  // --- Session handlers ---
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError("");
    try {
      await createSession(id!, {
        trainerId: sessionTrainerId,
        title: sessionTitle,
        topic: sessionTopic || undefined,
        scheduledDate: new Date(sessionDate).toISOString(),
        startTime: new Date(`${sessionDate}T${sessionStartTime}`).toISOString(),
        endTime: new Date(`${sessionDate}T${sessionEndTime}`).toISOString(),
      });
      setSessionTitle("");
      setSessionTopic("");
      setSessionTrainerId("");
      setSessionDate("");
      setSessionStartTime("");
      setSessionEndTime("");
      setShowSessionForm(false);
      setSessions(await getSessions(id!));
    } catch (err: any) {
      setSessionError(
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        "Failed to create session"
      );
    }
  };

  function startEditSession(s: SessionItem) {
    setEditingSession(s.id);
    setEditTitle(s.title);
    setEditTopic(s.topic || "");
    setEditTrainerId(s.trainer.id);
    setEditDate(s.scheduledDate.split("T")[0]);
    setEditStartTime(new Date(s.startTime).toTimeString().slice(0, 5));
    setEditEndTime(new Date(s.endTime).toTimeString().slice(0, 5));
    setEditError("");
  }

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    setEditError("");
    try {
      const session = sessions.find((s) => s.id === editingSession)!;
      await updateSession(editingSession, {
        trainerId: editTrainerId,
        title: editTitle,
        topic: editTopic || undefined,
        scheduledDate: new Date(editDate).toISOString(),
        startTime: new Date(`${editDate}T${editStartTime}`).toISOString(),
        endTime: new Date(`${editDate}T${editEndTime}`).toISOString(),
      });
      setEditingSession(null);
      setSessions(await getSessions(id!));
    } catch (err: any) {
      setEditError(
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        "Failed to update session"
      );
    }
  };

  const handleDeleteSession = async (sid: string) => {
    setConfirmDeleteSession(null);
    setSessionError("");
    try {
      await deleteSession(sid);
      setSessions(await getSessions(id!));
    } catch (err: any) {
      setSessionError(err.response?.data?.error || "Failed to delete session");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading batch details…
      </div>
    );
  }

  if (error && !batch) {
    return (
      <div className="py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4">{error}</div>
        <Link to="/batches" className="text-blue-600 hover:underline text-sm">&larr; Back to Batches</Link>
      </div>
    );
  }

  if (!batch) return <p className="text-red-500 py-8">Batch not found.</p>;

  return (
    <div>
      <Link to="/batches" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Batches</Link>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4 text-sm">{error}</div>
      )}

      {/* Batch Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{batch.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {batch.department && <span className="mr-2">{batch.department}</span>}
            {new Date(batch.startDate).toLocaleDateString()}
            {batch.endDate && ` — ${new Date(batch.endDate).toLocaleDateString()}`}
          </p>
          {batch.description && <p className="text-gray-600 text-sm mt-2">{batch.description}</p>}
        </div>
        {isAdmin && (
          <Link
            to={`/batches/${id}/edit`}
            className="bg-gray-100 border px-4 py-2 rounded text-sm hover:bg-gray-200"
          >
            Edit Batch
          </Link>
        )}
      </div>

      {/* Trainers */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Trainers ({batch.trainers?.length || 0})
        </h2>

        {batch.trainers?.length > 0 && (
          <div className="bg-white border rounded-lg mb-3 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Assigned</th>
                  {isAdmin && <th className="text-left px-4 py-2 text-sm font-medium text-gray-600 w-28">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {batch.trainers.map((t: BatchTrainer) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2 text-sm font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{t.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(t.assignedAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-sm">
                        {confirmRemoveTrainer === t.id ? (
                          <span className="flex items-center gap-2">
                            <button onClick={() => handleRemoveTrainer(t.id)} className="text-red-700 font-medium text-xs hover:underline">Yes</button>
                            <button onClick={() => setConfirmRemoveTrainer(null)} className="text-gray-500 text-xs hover:underline">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmRemoveTrainer(t.id)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && (
          <>
            <form onSubmit={handleAssignTrainer} className="flex items-end gap-2 max-w-lg">
              <div className="flex-1">
                <UserPicker
                  label="Assign Trainer"
                  roleId={roleIdFor("TRAINER")}
                  value={trainerId}
                  onChange={(uid) => setTrainerId(uid)}
                  placeholder="Search trainers…"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 mb-px">
                Assign
              </button>
            </form>
            {trainerError && <p className="text-red-500 text-sm mt-1">{trainerError}</p>}
          </>
        )}
      </section>

      {/* Students / Roster */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Students ({roster.length})</h2>

        {roster.length > 0 && (
          <div className="bg-white border rounded-lg mb-3 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Joined</th>
                  {isAdmin && <th className="text-left px-4 py-2 text-sm font-medium text-gray-600 w-28">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.department || "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(s.joinedAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-sm">
                        {confirmRemoveStudent === s.id ? (
                          <span className="flex items-center gap-2">
                            <button onClick={() => handleRemoveStudent(s.id)} className="text-red-700 font-medium text-xs hover:underline">Yes</button>
                            <button onClick={() => setConfirmRemoveStudent(null)} className="text-gray-500 text-xs hover:underline">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmRemoveStudent(s.id)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && (
          <>
            <form onSubmit={handleAddStudent} className="flex items-end gap-2 max-w-lg">
              <div className="flex-1">
                <UserPicker
                  label="Add Student"
                  roleId={roleIdFor("STUDENT")}
                  value={studentId}
                  onChange={(uid) => setStudentId(uid)}
                  placeholder="Search students…"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 mb-px">
                Add
              </button>
            </form>
            {studentError && <p className="text-red-500 text-sm mt-1">{studentError}</p>}
          </>
        )}
      </section>

      {/* Sessions */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Sessions ({sessions.length})</h2>
          {canManageSessions && (
            <button
              onClick={() => { setShowSessionForm(!showSessionForm); setEditingSession(null); }}
              className="bg-gray-100 border px-3 py-1 rounded text-sm hover:bg-gray-200"
            >
              {showSessionForm ? "Cancel" : "+ New Session"}
            </button>
          )}
        </div>

        {sessionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm">{sessionError}</div>
        )}

        {/* Create Session Form */}
        {showSessionForm && canManageSessions && (
          <div className="bg-white border rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-800 mb-3">Create Session</h3>
            {sessionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm">{sessionError}</div>
            )}
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                  <input type="text" value={sessionTopic} onChange={(e) => setSessionTopic(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <UserPicker
                    label="Trainer"
                    roleId={roleIdFor("TRAINER")}
                    value={sessionTrainerId}
                    onChange={(uid) => setSessionTrainerId(uid)}
                    placeholder="Search trainers…"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" value={sessionStartTime} onChange={(e) => setSessionStartTime(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={sessionEndTime} onChange={(e) => setSessionEndTime(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" required />
                </div>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                Create Session
              </button>
            </form>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Topic</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Trainer</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  editingSession === s.id ? (
                    <tr key={s.id} className="border-t bg-blue-50">
                      <td colSpan={6} className="px-4 py-3">
                        <form onSubmit={handleUpdateSession} className="space-y-3">
                          {editError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-sm">{editError}</div>
                          )}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" required />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                              <input type="text" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                            </div>
                            <UserPicker
                              label="Trainer"
                              roleId={roleIdFor("TRAINER")}
                              value={editTrainerId}
                              onChange={(uid) => setEditTrainerId(uid)}
                              placeholder="Search trainers…"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" required />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                              <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" required />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                              <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" required />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Save</button>
                            <button type="button" onClick={() => setEditingSession(null)} className="border px-3 py-1 rounded text-sm hover:bg-gray-100">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium">{s.title}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{s.topic || "—"}</td>
                      <td className="px-4 py-2 text-sm">{new Date(s.scheduledDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" — "}
                        {new Date(s.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2 text-sm">{s.trainer.name}</td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {user?.role === "TRAINER" && (
                            <Link to={`/attendance/mark/${s.id}`} className="text-blue-600 hover:text-blue-800 text-xs">Attendance</Link>
                          )}
                          <Link to={`/attendance/session/${s.id}`} className="text-gray-600 hover:text-gray-800 text-xs">View</Link>
                          {canManageSessions && (
                            <button onClick={() => startEditSession(s)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                          )}
                          {canManageSessions && (
                            confirmDeleteSession === s.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => handleDeleteSession(s.id)} className="text-red-700 font-medium text-xs hover:underline">Yes</button>
                                <button onClick={() => setConfirmDeleteSession(null)} className="text-gray-500 text-xs hover:underline">No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDeleteSession(s.id)} className="text-red-600 hover:text-red-800 text-xs">Delete</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sessions.length === 0 && !showSessionForm && (
          <p className="text-gray-400 text-sm">No sessions yet.</p>
        )}
      </section>
    </div>
  );
}
