import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAssessment, submitQuestionScores, getStudentAssessmentResult } from "../../services/assessments.service";

export function ScoreEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<any>(null);
  const [studentId, setStudentId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAssessment(id).then((res: any) => setAssessment(res?.data ?? res));
  }, [id]);

  const loadStudentScores = async () => {
    if (!studentId || !id) return;
    setLoading(true);
    setError("");
    try {
      const result = await getStudentAssessmentResult(id, studentId);
      if (result && assessment?.sections) {
        // Pre-fill scores from existing results
        const existingScores: Record<string, number> = {};
        assessment.sections.forEach((section: any) => {
          section.questions?.forEach((q: any) => {
            const studentScore = q.studentScores?.find((ss: any) => ss.studentId === studentId);
            if (studentScore) {
              existingScores[q.id] = studentScore.score;
            }
          });
        });
        setScores(existingScores);
        setRemarks(result.remarks || "");
        setIsEditing(true);
        setSuccessMsg("Loaded existing scores for editing");
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setSuccessMsg("No existing scores found. Enter new scores.");
        setIsEditing(false);
      } else {
        setError(err.response?.data?.error || "Failed to load student scores");
      }
    }
    setLoading(false);
  };

  if (!assessment) return <p className="text-gray-500">Loading...</p>;

  const calculateSectionTotal = (section: any) =>
    section.questions.reduce((sum: number, q: any) => sum + (scores[q.id] || 0), 0);

  const calculateSectionMax = (section: any) =>
    section.questions.reduce((sum: number, q: any) => sum + q.maxScore, 0);

  const overallTotal = assessment.sections?.reduce(
    (sum: number, s: any) => sum + calculateSectionTotal(s),
    0
  ) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    const questionScores = Object.entries(scores)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([questionId, score]) => ({ questionId, score }));

    if (questionScores.length === 0) {
      setError("Enter at least one score");
      setSubmitting(false);
      return;
    }

    try {
      await submitQuestionScores(id!, {
        studentId,
        questionScores,
        remarks: remarks || undefined,
      });
      setSuccessMsg("Scores submitted. Overall score calculated.");
      setScores({});
      setRemarks("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit scores");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Enter/Edit Assessment Scores</h1>
      <p className="text-gray-500 mb-6">{assessment.title}</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
              required
              placeholder="Enter student UUID"
            />
            <button
              type="button"
              onClick={loadStudentScores}
              disabled={!studentId || loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? "Loading..." : "Load Scores"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter Student ID and click "Load Scores" to edit existing scores, or enter new scores below
          </p>
        </div>

        {assessment.sections?.map((section: any) => (
          <div key={section.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">{section.title}</h3>
              <span className="text-sm text-gray-500">
                {calculateSectionTotal(section)}/{calculateSectionMax(section)}
                {section.weightage !== null && ` (${section.weightage}%)`}
              </span>
            </div>

            {section.questions?.map((q: any) => (
              <div key={q.id} className="flex items-center gap-3 ml-4 mb-2">
                <label className="flex-1 text-sm">{q.label}</label>
                <input
                  type="number"
                  value={scores[q.id] ?? ""}
                  onChange={(e) =>
                    setScores({ ...scores, [q.id]: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24 border rounded px-2 py-1 text-sm"
                  min="0"
                  max={q.maxScore}
                  step="0.01"
                />
                <span className="text-xs text-gray-400">/ {q.maxScore}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="flex items-center justify-between bg-gray-100 p-3 rounded">
          <span className="font-medium">Overall Total</span>
          <span className="font-bold">
            {overallTotal} / {assessment.maxScore}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {submitting ? "Submitting..." : isEditing ? "Update Scores" : "Submit Scores"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/assessments/${id}`)}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Back to Assessment
          </button>
        </div>
      </form>
    </div>
  );
}
export default ScoreEntry;
