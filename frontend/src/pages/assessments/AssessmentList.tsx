import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssessments, deleteAssessment } from "../../services/assessments.service";

interface AssessmentSummary {
  id: string;
  title: string;
  type: string;
  batchName: string;
  maxScore: number;
  assessmentDate: string;
  sectionCount: number;
  questionCount: number;
  resultCount: number;
}

export default function AssessmentList() {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      const res = await getAssessments(params);
      setAssessments(res.data || []);
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
        <h1 className="text-2xl font-bold">Assessments</h1>
        <Link
          to="/assessments/create"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Assessment
        </Link>
      </div>

      <div className="mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="CODING_TEST">Coding Test</option>
          <option value="QUIZ">Quiz</option>
          <option value="ASSIGNMENT">Assignment</option>
          <option value="CONTEST">Contest</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : assessments.length === 0 ? (
        <p className="text-gray-500">No assessments found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Batch</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Max Score
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Sections
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Results
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/assessments/${a.id}`} className="text-blue-600 hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{a.type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm">{a.batchName}</td>
                  <td className="px-4 py-3 text-sm">{a.maxScore}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(a.assessmentDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {a.sectionCount} ({a.questionCount} Q)
                  </td>
                  <td className="px-4 py-3 text-sm">{a.resultCount}</td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <Link
                      to={`/assessments/${a.id}/edit`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </Link>
                    <Link
                      to={`/assessments/${a.id}/bulk-upload`}
                      className="text-green-600 hover:text-green-800"
                    >
                      Upload
                    </Link>
                    <button
                      onClick={() => handleDelete(a.id)}
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
  );
}
