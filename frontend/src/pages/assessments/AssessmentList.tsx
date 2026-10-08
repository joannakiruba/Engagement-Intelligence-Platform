import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssessments, deleteAssessment } from "../../services/assessments.service";
import { useAuth } from "../../context/AuthContext";

interface AssessmentSummary {
  id: string;
  title: string;
  type: string;
  batchName?: string;
  maxScore: number;
  assessmentDate: string;
  sectionCount?: number;
  questionCount?: number;
  resultCount?: number;
}

export function AssessmentList() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('assessments:create:batch');
  const canUpload = canManage || hasPermission('assessments:read:assigned');
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      const res: any = await getAssessments(params);
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setAssessments(list);
    } catch {
      setAssessments([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [typeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this assessment and all related data?")) return;
    await deleteAssessment(id);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500">Track tests, quizzes, assignments, and contests across batches</p>
        </div>
        {canManage && (
          <Link
            to="/assessments/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-xs"
          >
            + Create Assessment
          </Link>
        )}
      </div>

      <div className="mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Types</option>
          <option value="CODING_TEST">Coding Test</option>
          <option value="QUIZ">Quiz</option>
          <option value="ASSIGNMENT">Assignment</option>
          <option value="CONTEST">Contest</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading assessments...</p>
      ) : assessments.length === 0 ? (
        <p className="text-gray-500">No assessments found.</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Max Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                {canUpload && <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/assessments/${a.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {a.type?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{a.maxScore}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {a.assessmentDate ? new Date(a.assessmentDate).toLocaleDateString() : 'N/A'}
                  </td>
                  {canUpload && (
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      {canManage && <Link
                        to={`/assessments/${a.id}/scores`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded bg-indigo-50"
                      >Scores</Link>}
                      <Link
                        to={`/assessments/${a.id}/upload`}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded bg-emerald-50"
                      >
                        Upload CSV
                      </Link>
                      {canManage && <button
                        onClick={() => handleDelete(a.id)}
                        className="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded bg-rose-50"
                      >
                        Delete
                      </button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default AssessmentList;
