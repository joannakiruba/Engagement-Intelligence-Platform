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

interface Trainer {
  id: string;
  name: string;
  email: string;
  assignedAt: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  department: string | null;
  joinedAt: string;
}

interface Session {
  id: string;
  title: string;
  topic: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  trainer: { id: string; name: string; email: string };
}

export default function BatchDetail() {
  const { id } = useParams();

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
      const [batchRes, rosterRes, sessionsRes] = await Promise.all([
        getBatch(id),
        getRoster(id),
        getSessions(id),
      ]);
      setBatch(batchRes.data);
      setRoster(rosterRes.data || []);
      setSessions(sessionsRes.data || []);
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
      const res = await getRoster(id!);
      setRoster(res.data || []);
    } catch (err: any) {
      setStudentError(err.response?.data?.error || "Failed to add student");
    }
  };

  const handleRemoveStudent = async (sid: string) => {
    if (!confirm("Remove this student from the batch?")) return;
    try {
      await removeStudent(id!, sid);
      const res = await getRoster(id!);
      setRoster(res.data || []);
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
      const res = await getBatch(id!);
      setBatch(res.data);
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to assign trainer");
    }
  };

  const handleRemoveTrainer = async (tid: string) => {
    if (!confirm("Remove this trainer from the batch?")) return;
    try {
      await removeTrainer(id!, tid);
      const res = await getBatch(id!);
      setBatch(res.data);
    } catch (err: any) {
      setTrainerError(err.response?.data?.error || "Failed to remove trainer");
    }
  };

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
      const res = await getSessions(id!);
      setSessions(res.data || []);
    } catch (err: any) {
      setSessionError(
        err.response?.data?.error ||
          err.response?.data?.details?.[0]?.message ||
          "Failed to create session"
      );
    }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await deleteSession(sid);
      const res = await getSessions(id!);
      setSessions(res.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete session");
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!batch) return <p className="text-red-500">Batch not found.</p>;

  return (
    <div>
      {/* Batch Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{batch.name}</h1>
          <p className="text-gray-500">
            {batch.department && `${batch.department} | `}
            {new Date(batch.startDate).toLocaleDateString()}
            {batch.endDate && ` — ${new Date(batch.endDate).toLocaleDateString()}`}
          </p>
          {batch.description && <p className="text-gray-600 mt-1">{batch.description}</p>}
        </div>
        <Link
          to={`/batches/${id}/edit`}
          className="bg-gray-100 border px-4 py-2 rounded text-sm hover:bg-gray-200"
        >
          Edit Batch
        </Link>
      </div>

      {/* Trainers */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Trainers ({batch.trainers?.length || 0})
        </h2>

        {batch.trainers?.length > 0 && (
          <div className="bg-white border rounded-lg mb-3">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Assigned</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batch.trainers.map((t: Trainer) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2 text-sm">{t.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{t.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(t.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => handleRemoveTrainer(t.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAssignTrainer} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Trainer ID (UUID)"
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm flex-1 max-w-md"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Assign Trainer
          </button>
        </form>
        {trainerError && <p className="text-red-500 text-sm mt-1">{trainerError}</p>}
      </div>

      {/* Students / Roster */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Students ({roster.length})</h2>

        {roster.length > 0 && (
          <div className="bg-white border rounded-lg mb-3">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Joined</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2 text-sm">{s.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.department || "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(s.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => handleRemoveStudent(s.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAddStudent} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Student ID (UUID)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm flex-1 max-w-md"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Add Student
          </button>
        </form>
        {studentError && <p className="text-red-500 text-sm mt-1">{studentError}</p>}
      </div>

      {/* Sessions */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Sessions ({sessions.length})</h2>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            className="bg-gray-100 border px-3 py-1 rounded text-sm hover:bg-gray-200"
          >
            {showSessionForm ? "Cancel" : "+ Create Session"}
          </button>
        </div>

        {showSessionForm && (
          <div className="bg-white border rounded-lg p-4 mb-4">
            {sessionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm">
                {sessionError}
              </div>
            )}
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={sessionTopic}
                    onChange={(e) => setSessionTopic(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trainer ID
                  </label>
                  <input
                    type="text"
                    value={sessionTrainerId}
                    onChange={(e) => setSessionTrainerId(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    placeholder="UUID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
              >
                Create Session
              </button>
            </form>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="bg-white border rounded-lg">
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
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{s.title}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.topic || "—"}</td>
                    <td className="px-4 py-2 text-sm">
                      {new Date(s.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {new Date(s.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" — "}
                      {new Date(s.endTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-sm">{s.trainer.name}</td>
                    <td className="px-4 py-2 text-sm flex gap-2">
                      <Link
                        to={`/attendance/mark/${s.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Mark Attendance
                      </Link>
                      <Link
                        to={`/attendance/session/${s.id}`}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
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
