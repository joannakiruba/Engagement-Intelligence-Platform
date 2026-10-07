import { useState } from "react";
import {
  createIntervention,
  type MentorAlert,
} from "../../services/interventions.service";
import { useNavigate } from "react-router-dom";

const CAUSE_LABELS: Record<string, string> = {
  ATTENDANCE_DECLINE: "Attendance Decline",
  ASSESSMENT_UNDERPERFORMANCE: "Assessment Underperformance",
  FEEDBACK_CONCERN: "Feedback / Engagement Concern",
};

interface Props {
  alert: MentorAlert;
  causeCode: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateInterventionModal({
  alert,
  causeCode,
  onClose,
  onCreated,
}: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(
    `${CAUSE_LABELS[causeCode] || causeCode} — ${alert.student_name}`,
  );
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await createIntervention({
        alertId: alert.id,
        causeCode,
        title: title.trim(),
        description,
        deadline: deadline || undefined,
      });
      if (result.existing) {
        navigate(`/interventions/${result.intervention.id}`);
      } else {
        onCreated();
        navigate(`/interventions/${result.intervention.id}`);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to create intervention.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Create Intervention
        </h2>

        <div className="bg-gray-50 rounded p-3 mb-4 text-sm space-y-1">
          <p>
            <span className="text-gray-500">Student:</span>{" "}
            <span className="font-medium">{alert.student_name}</span>
          </p>
          <p>
            <span className="text-gray-500">Cause:</span>{" "}
            <span className="font-medium">
              {CAUSE_LABELS[causeCode] || causeCode}
            </span>
          </p>
          <p>
            <span className="text-gray-500">Risk Score:</span>{" "}
            {alert.risk_score.toFixed(0)}
          </p>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Plan / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Describe the support plan..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
