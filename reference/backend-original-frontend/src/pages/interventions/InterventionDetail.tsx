import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getIntervention,
  updateIntervention,
  completeIntervention,
  editOutcome,
  createTask,
  updateTask,
  createNote,
  updateNote,
  deleteNote,
  type Intervention,
  type InterventionTask,
} from "../../services/interventions.service";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const CAUSE_LABELS: Record<string, string> = {
  ATTENDANCE_DECLINE: "Attendance Decline",
  ASSESSMENT_UNDERPERFORMANCE: "Assessment Underperformance",
  FEEDBACK_CONCERN: "Feedback / Engagement Concern",
};

function isOverdue(task: InterventionTask): boolean {
  return !task.isCompleted && !!task.deadline && new Date(task.deadline) < new Date();
}

function isCompletedLate(task: InterventionTask): boolean {
  return (
    task.isCompleted &&
    !!task.deadline &&
    !!task.completedAt &&
    new Date(task.completedAt) > new Date(task.deadline)
  );
}

export default function InterventionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOwner = user && intervention?.mentorId === user.id;
  const isStudent = user && intervention?.studentId === user.id;
  const isTerminal =
    intervention?.status === "COMPLETED" ||
    intervention?.status === "CANCELLED";
  const canEdit = isOwner && !isTerminal;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getIntervention(id);
      setIntervention(data);
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        setError("Intervention not found or you do not have access.");
      } else {
        setError("Failed to load intervention.");
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Status actions ──
  const [statusSaving, setStatusSaving] = useState(false);

  async function handleStatusChange(newStatus: "IN_PROGRESS" | "CANCELLED") {
    if (!intervention) return;
    setStatusSaving(true);
    try {
      const updated = await updateIntervention(intervention.id, {
        status: newStatus,
      });
      setIntervention(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update status.");
    }
    setStatusSaving(false);
  }

  // ── Plan editing ──
  const [editingPlan, setEditingPlan] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planDeadline, setPlanDeadline] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  function startPlanEdit() {
    if (!intervention) return;
    setPlanTitle(intervention.title);
    setPlanDesc(intervention.description);
    setPlanDeadline(
      intervention.deadline
        ? new Date(intervention.deadline).toISOString().split("T")[0]
        : "",
    );
    setEditingPlan(true);
  }

  async function savePlan() {
    if (!intervention) return;
    setPlanSaving(true);
    try {
      const updated = await updateIntervention(intervention.id, {
        title: planTitle,
        description: planDesc,
        deadline: planDeadline || null,
      });
      setIntervention(updated);
      setEditingPlan(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save plan.");
    }
    setPlanSaving(false);
  }

  // ── Completion ──
  const [showComplete, setShowComplete] = useState(false);
  const [outcomeVal, setOutcomeVal] = useState<string>("IMPROVED");
  const [outcomeRemarks, setOutcomeRemarks] = useState("");
  const [completeSaving, setCompleteSaving] = useState(false);

  async function handleComplete() {
    if (!intervention) return;
    setCompleteSaving(true);
    try {
      const updated = await completeIntervention(intervention.id, {
        outcome: outcomeVal,
        remarks: outcomeRemarks,
      });
      setIntervention(updated);
      setShowComplete(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to complete.");
    }
    setCompleteSaving(false);
  }

  // ── Outcome editing ──
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [editOutcomeVal, setEditOutcomeVal] = useState("");
  const [editOutcomeRemarks, setEditOutcomeRemarks] = useState("");
  const [outcomeSaving, setOutcomeSaving] = useState(false);

  function startOutcomeEdit() {
    if (!intervention?.outcome) return;
    setEditOutcomeVal(intervention.outcome.outcome);
    setEditOutcomeRemarks(intervention.outcome.remarks || "");
    setEditingOutcome(true);
  }

  async function saveOutcomeEdit() {
    if (!intervention) return;
    setOutcomeSaving(true);
    try {
      await editOutcome(intervention.id, {
        outcome: editOutcomeVal,
        remarks: editOutcomeRemarks,
      });
      await load();
      setEditingOutcome(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to edit outcome.");
    }
    setOutcomeSaving(false);
  }

  // ── Tasks ──
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  async function handleAddTask() {
    if (!intervention || !newTaskTitle.trim()) return;
    setTaskSaving(true);
    try {
      await createTask(intervention.id, {
        title: newTaskTitle.trim(),
        description: newTaskDesc || undefined,
        deadline: newTaskDeadline || null,
      });
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskDeadline("");
      setShowAddTask(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add task.");
    }
    setTaskSaving(false);
  }

  async function handleToggleTask(task: InterventionTask) {
    if (!intervention) return;
    try {
      await updateTask(intervention.id, task.id, {
        isCompleted: !task.isCompleted,
      });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update task.");
    }
  }

  // ── Task editing ──
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskDeadline, setEditTaskDeadline] = useState("");

  function startTaskEdit(task: InterventionTask) {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDesc(task.description || "");
    setEditTaskDeadline(
      task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : "",
    );
  }

  async function saveTaskEdit() {
    if (!intervention || !editingTaskId) return;
    setTaskSaving(true);
    try {
      await updateTask(intervention.id, editingTaskId, {
        title: editTaskTitle,
        description: editTaskDesc || undefined,
        deadline: editTaskDeadline || null,
      });
      setEditingTaskId(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update task.");
    }
    setTaskSaving(false);
  }

  // ── Notes ──
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  async function handleAddNote() {
    if (!intervention || !newNote.trim()) return;
    setNoteSaving(true);
    try {
      await createNote(intervention.id, newNote.trim());
      setNewNote("");
      setShowAddNote(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add note.");
    }
    setNoteSaving(false);
  }

  async function handleEditNote(noteId: string) {
    if (!intervention || !editNoteText.trim()) return;
    setNoteSaving(true);
    try {
      await updateNote(intervention.id, noteId, editNoteText.trim());
      setEditingNoteId(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update note.");
    }
    setNoteSaving(false);
  }

  async function handleDeleteNote(noteId: string) {
    if (!intervention || !confirm("Delete this note?")) return;
    try {
      await deleteNote(intervention.id, noteId);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete note.");
    }
  }

  if (loading) return <p className="text-gray-500 p-4">Loading...</p>;
  if (error && !intervention)
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/interventions" className="text-blue-600 hover:underline">
          Back to interventions
        </Link>
      </div>
    );
  if (!intervention) return null;

  return (
    <div className="max-w-4xl">
      <Link
        to="/interventions"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        &larr; Back to interventions
      </Link>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {/* Header */}
      <div className="bg-white border rounded-lg p-6 mb-4">
        {editingPlan ? (
          <div className="space-y-3">
            <input
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 font-medium"
            />
            <textarea
              value={planDesc}
              onChange={(e) => setPlanDesc(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Deadline:</label>
              <input
                type="date"
                value={planDeadline}
                onChange={(e) => setPlanDeadline(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={savePlan}
                disabled={planSaving}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {planSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingPlan(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">
                  {intervention.title}
                </h1>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[intervention.status]}`}
                  >
                    {intervention.status.replace("_", " ")}
                  </span>
                  {intervention.causeCode && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {CAUSE_LABELS[intervention.causeCode] ||
                        intervention.causeCode}
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={startPlanEdit}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-500">Student: </span>
                <span className="font-medium">
                  {intervention.student.name}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Mentor: </span>
                <span className="font-medium">
                  {intervention.mentor.name}
                </span>
              </div>
              {intervention.deadline && (
                <div>
                  <span className="text-gray-500">Deadline: </span>
                  <span>
                    {new Date(intervention.deadline).toLocaleDateString()}
                  </span>
                </div>
              )}
              {intervention.completedAt && (
                <div>
                  <span className="text-gray-500">Completed: </span>
                  <span>
                    {new Date(intervention.completedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {intervention.riskScore && (
                <div>
                  <span className="text-gray-500">Risk at creation: </span>
                  <span>
                    {intervention.riskScore.totalScore.toFixed(0)} (
                    {intervention.riskScore.riskLevel})
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Created: </span>
                <span>
                  {new Date(intervention.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {intervention.description && (
              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                <p className="whitespace-pre-wrap">
                  {intervention.description}
                </p>
              </div>
            )}

            {/* Status actions */}
            {canEdit && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                {intervention.status === "PENDING" && (
                  <button
                    onClick={() => handleStatusChange("IN_PROGRESS")}
                    disabled={statusSaving}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Start Working
                  </button>
                )}
                <button
                  onClick={() => setShowComplete(true)}
                  disabled={statusSaving}
                  className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Complete with Outcome
                </button>
                <button
                  onClick={() => handleStatusChange("CANCELLED")}
                  disabled={statusSaving}
                  className="text-sm text-red-600 hover:text-red-800 px-3"
                >
                  Cancel Intervention
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Outcome */}
      {intervention.outcome && (
        <div className="bg-white border rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Final Outcome</h2>
            {isOwner && (
              <button
                onClick={startOutcomeEdit}
                className="text-xs text-gray-500 hover:underline"
              >
                Edit Outcome
              </button>
            )}
          </div>
          {editingOutcome ? (
            <div className="space-y-3">
              <select
                value={editOutcomeVal}
                onChange={(e) => setEditOutcomeVal(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="IMPROVED">Improved</option>
                <option value="NO_CHANGE">No Change</option>
                <option value="DECLINED">Declined</option>
              </select>
              <textarea
                value={editOutcomeRemarks}
                onChange={(e) => setEditOutcomeRemarks(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Remarks..."
              />
              <div className="flex gap-2">
                <button
                  onClick={saveOutcomeEdit}
                  disabled={outcomeSaving}
                  className="bg-blue-600 text-white px-4 py-1 rounded text-sm disabled:opacity-50"
                >
                  {outcomeSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingOutcome(false)}
                  className="text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  intervention.outcome.outcome === "IMPROVED"
                    ? "bg-green-100 text-green-700"
                    : intervention.outcome.outcome === "NO_CHANGE"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {intervention.outcome.outcome.replace("_", " ")}
              </span>
              {intervention.outcome.remarks && (
                <p className="mt-2 text-gray-600">
                  {intervention.outcome.remarks}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Recorded{" "}
                {new Date(
                  intervention.outcome.recordedAt,
                ).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Tasks ({intervention.tasks.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowAddTask(true)}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Add Task
            </button>
          )}
        </div>

        {intervention.tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {intervention.tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded p-3 ${isOverdue(task) ? "border-red-300 bg-red-50" : ""}`}
              >
                {editingTaskId === task.id ? (
                  <div className="space-y-2">
                    <input
                      value={editTaskTitle}
                      onChange={(e) => setEditTaskTitle(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                    <textarea
                      value={editTaskDesc}
                      onChange={(e) => setEditTaskDesc(e.target.value)}
                      rows={2}
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="Description..."
                    />
                    <input
                      type="date"
                      value={editTaskDeadline}
                      onChange={(e) => setEditTaskDeadline(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveTaskEdit}
                        disabled={taskSaving}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTaskId(null)}
                        className="text-xs text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {canEdit && (
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() => handleToggleTask(task)}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${task.isCompleted ? "line-through text-gray-400" : "text-gray-900"}`}
                        >
                          {task.title}
                        </span>
                        {isOverdue(task) && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Overdue
                          </span>
                        )}
                        {isCompletedLate(task) && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            Completed late
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {task.deadline && (
                          <span>
                            Due:{" "}
                            {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {task.completedAt && (
                          <span>
                            Completed:{" "}
                            {new Date(task.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => startTaskEdit(task)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showAddTask && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <textarea
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={handleAddTask}
                disabled={taskSaving || !newTaskTitle.trim()}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
              >
                {taskSaving ? "Adding..." : "Add"}
              </button>
              <button
                onClick={() => setShowAddTask(false)}
                className="text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progress Notes */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Progress Notes ({intervention.updates.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowAddNote(true)}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Add Note
            </button>
          )}
        </div>

        {intervention.updates.length === 0 ? (
          <p className="text-sm text-gray-500">No progress notes yet.</p>
        ) : (
          <div className="space-y-3">
            {intervention.updates.map((note) => (
              <div key={note.id} className="border-l-2 border-blue-200 pl-3">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      rows={3}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditNote(note.id)}
                        disabled={noteSaving}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="text-xs text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {note.note}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        {new Date(note.createdAt).toLocaleString()}
                        {note.editedAt && " (edited)"}
                      </span>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditNoteText(note.note);
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showAddNote && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a progress note..."
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={noteSaving || !newNote.trim()}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
              >
                {noteSaving ? "Adding..." : "Add Note"}
              </button>
              <button
                onClick={() => setShowAddNote(false)}
                className="text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Complete modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">
              Complete Intervention
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outcome
                </label>
                <select
                  value={outcomeVal}
                  onChange={(e) => setOutcomeVal(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="IMPROVED">Improved</option>
                  <option value="NO_CHANGE">No Change</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks (optional)
                </label>
                <textarea
                  value={outcomeRemarks}
                  onChange={(e) => setOutcomeRemarks(e.target.value)}
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowComplete(false)}
                  className="text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completeSaving}
                  className="bg-green-600 text-white px-6 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {completeSaving ? "Completing..." : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
