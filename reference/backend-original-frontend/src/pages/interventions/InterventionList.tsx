import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  listInterventions,
  getMentorAlerts,
  getPendingCount,
  type Intervention,
  type MentorAlert,
} from "../../services/interventions.service";
import CreateInterventionModal from "./CreateInterventionModal";

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function hasOverdueTasks(intervention: Intervention): boolean {
  const now = new Date();
  return intervention.tasks.some(
    (t) =>
      !t.isCompleted &&
      t.deadline &&
      new Date(t.deadline) < now &&
      (intervention.status === "PENDING" || intervention.status === "IN_PROGRESS"),
  );
}

export default function InterventionList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMentor = user?.role === "MENTOR";
  const isStudent = user?.role === "STUDENT";

  const [tab, setTab] = useState<"alerts" | "interventions">(
    isMentor ? "alerts" : "interventions",
  );
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [alerts, setAlerts] = useState<MentorAlert[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [overdueFilter, setOverdueFilter] = useState(searchParams.get("overdue") === "true");

  const [createModal, setCreateModal] = useState<{
    alert: MentorAlert;
    causeCode: string;
  } | null>(null);

  async function loadInterventions() {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (overdueFilter) params.hasOverdueTasks = "true";
      const res = await listInterventions(params);
      setInterventions(res.data);
      setTotal(res.pagination?.total || res.data.length);
    } catch {
      setError("Failed to load interventions.");
    }
    setLoading(false);
  }

  async function loadAlerts() {
    if (!isMentor) return;
    try {
      const data = await getMentorAlerts();
      setAlerts(data);
    } catch {
      /* alerts may fail if ML service is down */
    }
  }

  async function loadPendingCount() {
    if (!isMentor) return;
    try {
      setPendingCount(await getPendingCount());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadInterventions();
    loadAlerts();
    loadPendingCount();
  }, [statusFilter, overdueFilter]);

  function handleFilterApply() {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (overdueFilter) params.overdue = "true";
    setSearchParams(params);
  }

  function handleCreated() {
    setCreateModal(null);
    loadInterventions();
    loadAlerts();
    loadPendingCount();
  }

  function getExistingIntervention(
    alert: MentorAlert,
    causeCode: string,
  ): { id: string; status: string; title: string } | undefined {
    return alert.interventions?.find(
      (i) => i.causeCode === causeCode && (i.status === "PENDING" || i.status === "IN_PROGRESS"),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isStudent ? "My Support Plans" : "Interventions"}
        </h1>
        {isMentor && pendingCount > 0 && (
          <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>

      {isMentor && (
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setTab("alerts")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "alerts" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Students Needing Support
            {alerts.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("interventions")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "interventions" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            My Interventions
          </button>
        </div>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Alerts Tab */}
      {isMentor && tab === "alerts" && (
        <div className="space-y-4">
          {alerts.length === 0 && !loading && (
            <p className="text-gray-500">No active alerts for your students.</p>
          )}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white border rounded-lg p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {alert.student_name}
                  </h3>
                  {alert.batch_name && (
                    <p className="text-sm text-gray-500">{alert.batch_name}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    alert.urgency_tier === "CRITICAL"
                      ? "bg-red-100 text-red-800"
                      : alert.urgency_tier === "HIGH"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {alert.urgency_tier}
                </span>
              </div>
              <div className="text-sm text-gray-700 space-y-1 mb-3">
                <p>
                  Risk Score: {alert.risk_score.toFixed(0)} (
                  {alert.risk_velocity >= 0 ? "+" : ""}
                  {alert.risk_velocity.toFixed(0)} change)
                </p>
                <p>Reason: {alert.trigger_reason}</p>
                <p>
                  Suggested:{" "}
                  {alert.recommended_intervention.replace(/_/g, " ")} (
                  {(alert.recommendation_confidence * 100).toFixed(0)}%
                  confidence)
                </p>
                <p className="text-gray-500 italic">
                  {alert.recommendation_reasoning}
                </p>
              </div>

              {/* Causes with action buttons */}
              {alert.causes && alert.causes.length > 0 ? (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Underlying Causes
                  </p>
                  {alert.causes.map((cause) => {
                    const existing = getExistingIntervention(
                      alert,
                      cause.cause_code,
                    );
                    return (
                      <div
                        key={cause.id}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-800">
                            {CAUSE_LABELS[cause.cause_code] || cause.cause_code}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            {Object.entries(cause.evidence || {})
                              .slice(0, 2)
                              .map(
                                ([k, v]) =>
                                  `${k.replace(/_/g, " ")}: ${typeof v === "number" ? (v as number).toFixed(1) : v}`,
                              )
                              .join(", ")}
                          </span>
                        </div>
                        {existing ? (
                          <Link
                            to={`/interventions/${existing.id}`}
                            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
                          >
                            Open Existing ({existing.status.replace("_", " ")})
                          </Link>
                        ) : (
                          <button
                            onClick={() =>
                              setCreateModal({
                                alert,
                                causeCode: cause.cause_code,
                              })
                            }
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            Create Intervention
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 italic">
                    Legacy alert — structured causes not available. Intervention
                    creation requires a re-generated alert with cause data.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interventions Tab */}
      {(tab === "interventions" || !isMentor) && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            {isMentor && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={overdueFilter}
                  onChange={(e) => setOverdueFilter(e.target.checked)}
                  className="rounded"
                />
                Has overdue tasks
              </label>
            )}
            <button
              onClick={handleFilterApply}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
            >
              Apply
            </button>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : interventions.length === 0 ? (
            <p className="text-gray-500">
              {isStudent
                ? "You have no support plans yet."
                : "No interventions found."}
            </p>
          ) : (
            <div className="space-y-3">
              {interventions.map((intervention) => (
                <Link
                  key={intervention.id}
                  to={`/interventions/${intervention.id}`}
                  className="block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {intervention.title}
                        </h3>
                        <StatusBadge status={intervention.status} />
                        {hasOverdueTasks(intervention) && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Overdue tasks
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {!isStudent && (
                          <>Student: {intervention.student.name} &middot; </>
                        )}
                        {isStudent && (
                          <>Mentor: {intervention.mentor.name} &middot; </>
                        )}
                        {intervention.causeCode &&
                          CAUSE_LABELS[intervention.causeCode] && (
                            <>
                              {CAUSE_LABELS[intervention.causeCode]} &middot;{" "}
                            </>
                          )}
                        {intervention.tasks.length} task
                        {intervention.tasks.length !== 1 ? "s" : ""} &middot;{" "}
                        {intervention.updates.length} note
                        {intervention.updates.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(intervention.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
              {total > interventions.length && (
                <p className="text-center text-sm text-gray-400">
                  Showing {interventions.length} of {total}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {createModal && (
        <CreateInterventionModal
          alert={createModal.alert}
          causeCode={createModal.causeCode}
          onClose={() => setCreateModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
