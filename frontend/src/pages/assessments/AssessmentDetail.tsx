import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAssessment, getResults } from "../../services/assessments.service";

export default function AssessmentDetail() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAssessment(id), getResults(id)]).then(([aRes, rRes]) => {
      setAssessment(aRes.data);
      setResults(rRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!assessment) return <p className="text-red-500">Assessment not found.</p>;

  const hasWeightage = results?.assessment?.hasWeightage;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{assessment.title}</h1>
          <p className="text-gray-500">
            {assessment.type.replace("_", " ")} | Batch: {assessment.batch?.name} | Max Score:{" "}
            {assessment.maxScore} | Date:{" "}
            {new Date(assessment.assessmentDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/scores`}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Enter Scores
          </Link>
          <Link
            to={`/assessments/${id}/bulk-upload`}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            Bulk Upload
          </Link>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Structure</h2>
      {assessment.sections?.length === 0 ? (
        <p className="text-gray-500 mb-6">No sections defined.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {assessment.sections?.map((section: any) => (
            <div key={section.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">{section.title}</h3>
                {section.weightage !== null && (
                  <span className="text-sm text-gray-500">Weight: {section.weightage}%</span>
                )}
              </div>
              <div className="ml-4 space-y-1">
                {section.questions?.map((q: any) => (
                  <div key={q.id} className="flex justify-between text-sm text-gray-600">
                    <span>{q.label}</span>
                    <span>Max: {q.maxScore}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Results ({results?.results?.length || 0})</h2>
      {!results?.results?.length ? (
        <p className="text-gray-500">No results submitted yet.</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Student</th>
                {results.results[0]?.sections?.map((s: any) => (
                  <th
                    key={s.sectionId}
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600"
                  >
                    {s.sectionTitle}
                    {hasWeightage && <span className="text-xs text-gray-400"> (weighted)</span>}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Overall</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((r: any) => (
                <>
                  <tr
                    key={r.studentId}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedStudent(expandedStudent === r.studentId ? null : r.studentId)
                    }
                  >
                    <td className="px-4 py-3 text-sm">
                      <div>{r.studentName}</div>
                      <div className="text-gray-400 text-xs">{r.studentEmail}</div>
                    </td>
                    {r.sections?.map((s: any) => (
                      <td key={s.sectionId} className="px-4 py-3 text-sm">
                        {s.sectionScore}/{s.sectionMax}
                        {hasWeightage && s.weightedScore !== undefined && (
                          <span className="text-gray-400 text-xs">
                            {" "}
                            ({s.weightedScore})
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm font-medium">{r.overallScore}</td>
                  </tr>
                  {expandedStudent === r.studentId && (
                    <tr key={`${r.studentId}-detail`} className="bg-gray-50">
                      <td colSpan={100} className="px-4 py-3">
                        <div className="text-xs text-gray-600">
                          {assessment.sections?.map((section: any) => (
                            <div key={section.id} className="mb-2">
                              <strong>{section.title}:</strong>
                              {section.questions?.map((q: any) => {
                                const score = q.studentScores?.find(
                                  (ss: any) => ss.studentId === r.studentId
                                );
                                return (
                                  <span key={q.id} className="ml-3">
                                    {q.label}: {score?.score ?? "-"}/{q.maxScore}
                                  </span>
                                );
                              })}
                            </div>
                          ))}
                          {r.remarks && <p className="mt-1 italic">Remarks: {r.remarks}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
