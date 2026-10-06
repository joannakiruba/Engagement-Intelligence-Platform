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
  deleteSession,
} from "../../services/batches.service";
import { useAuth } from "../../context/AuthContext";

interface Trainer {
  id: string;
  name: string;
  email: string;
  assignedAt?: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  joinedAt?: string;
}

interface Session {
  id: string;
  title: string;
  topic?: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  trainer?: { id: string; name: string; email: string };
}

export function BatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "COORDINATOR";
  const canManageSessions = user && ["TRAINER", "ADMIN", "COORDINATOR"].includes(user.role);

  const [batch, setBatch] = useState<any>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add student form
  const [studentId, setStudentId] = useState("");
  const [studentError, setStudentError] = useState("");

  // Add trainer form
  const [trainerId, setTrainerId] = useState("");
  const [trainerError, setTrainerError] = useState("");

  // Create session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionTrainerId, setSessionTrainerId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionEndTime, setSessionEndTime] = useState("");
  const [sessionError, setSessionError] = useState("");

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [batchRes, rosterRes, sessionsRes]: any[] = await Promise.all([
        getBatch(id),
        getRoster(id),
        getSessions(id),
      ]);
      setBatch(batchRes?.data ?? batchRes);
      setRoster(Array.isArray(rosterRes) ? rosterRes : rosterRes?.data ?? []);
      setSessions(Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data ?? []);
    } catch {
      setError("Failed to load batch details");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError("");
    try {
      await addStudent(id!, studentId);
      setStudentId("");
      const res: any = await getRoster(id!);
      setRoster(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setStudentError(err.response?.data?.error || "Failed to add student");
    }
  };

  const handleRemoveStudent = async (sid: string) => {
    if (!confirm("Remove this student from the batch?")) return;
    try {
      await removeStudent(id!, sid);
      const res: any = await getRoster(id!);
      setRoster(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setStudentError(err.response?.data?.error || "Failed to remove student");
    }
  };

  const handleAssignTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrainerError("");
    try {
      await assignTrainer(id!, trainerId);
      setTrainerId("");
      const res: any = await getBatch(id!);
      setBatch(res?.data ?? res);
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to assign trainer");
    }
  };

  const handleRemoveTrainer = async (tid: string) => {
    if (!confirm("Remove this trainer from the batch?")) return;
    try {
      await removeTrainer(id!, tid);
      const res: any = await getBatch(id!);
      setBatch(res?.data ?? res);
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to remove trainer");
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError("");
    try {
      await createSession(id!, {
        trainerId: sessionTrainerId || undefined,
        title: sessionTitle,
        topic: sessionTopic || undefined,
        scheduledDate: new Date(sessionDate).toISOString(),
        startTime: sessionStartTime ? new Date(`${sessionDate}T${sessionStartTime}`).toISOString() : undefined,
        endTime: sessionEndTime ? new Date(`${sessionDate}T${sessionEndTime}`).toISOString() : undefined,
      });
      setSessionTitle("");
      setSessionTopic("");
      setSessionTrainerId("");
      setSessionDate("");
      setSessionStartTime("");
      setSessionEndTime("");
      setShowSessionForm(false);
      const res: any = await getSessions(id!);
      setSessions(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setSessionError(err.response?.data?.error || "Failed to create session");
    }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await deleteSession(sid);
      const res: any = await getSessions(id!);
      setSessions(Array.isArray(res) ? res : res?.data ?? []);
    } catch {
      alert("Failed to delete session");
    }
  };

  if (loading) return <p className="text-gray-500">Loading batch details...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!batch) return <p className="text-gray-500">Batch not found.</p>;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{batch.name}</h1>
            <p className="text-gray-500">
              Department: {batch.department || "General"} | Start:{" "}
              {new Date(batch.startDate).toLocaleDateString()}
              {batch.endDate && ` | End: ${new Date(batch.endDate).toLocaleDateString()}`}
            </p>
            {batch.description && <p className="text-gray-600 mt-2">{batch.description}</p>}
          </div>
          <Link
            to="/batches"
            className="text-sm text-indigo-600 hover:underline"
          >
            &larr; Back to Batches
          </Link>
        </div>
      </div>

      {/* Roster & Students */}
      <div className="bg-white border rounded-xl p-6 shadow-xs">
        <h2 className="text-lg font-bold mb-4">Student Roster ({roster.length})</h2>
        {isAdmin && (
          <form onSubmit={handleAddStudent} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Student ID / UUID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 font-medium"
            >
              Add Student
            </button>
          </form>
        )}
        {studentError && <p className="text-red-600 text-xs mb-2">{studentError}</p>}
        {roster.length === 0 ? (
          <p className="text-gray-400 text-sm">No students enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Department</th>
                  {isAdmin && <th className="text-right px-3 py-2">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-slate-500">{s.email}</td>
                    <td className="px-3 py-2 text-slate-500">{s.department || "—"}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleRemoveStudent(s.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessions Section */}
      <div className="bg-white border rounded-xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Scheduled Sessions ({sessions.length})</h2>
          {canManageSessions && (
            <button
              onClick={() => setShowSessionForm(!showSessionForm)}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              {showSessionForm ? "Cancel" : "+ Schedule Session"}
            </button>
          )}
        </div>

        {showSessionForm && (
          <form onSubmit={handleCreateSession} className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                  placeholder="e.g. Session 1: Trees & Graphs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Topic</label>
                <input
                  type="text"
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                  placeholder="Topic details"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                />
              </div>
            </div>
            {sessionError && <p className="text-rose-600 text-xs">{sessionError}</p>}
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              Save Session
            </button>
          </form>
        )}

        {sessions.length === 0 ? (
          <p className="text-slate-400 text-sm">No sessions scheduled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Session Title</th>
                  <th className="text-left px-3 py-2">Topic</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{s.title}</td>
                    <td className="px-3 py-2 text-slate-500">{s.topic || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <Link
                        to={`/attendance/session/${s.id}`}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Attendance
                      </Link>
                      {canManageSessions && (
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default BatchDetail;
