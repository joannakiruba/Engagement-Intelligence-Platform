import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { bulkUploadScores } from "../../services/assessments.service";

export function BulkUpload() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file");
      return;
    }
    setError("");
    setResult(null);
    setUploading(true);

    try {
      const res = await bulkUploadScores(id!, file);
      setResult(res?.data ?? res);
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    }
    setUploading(false);
  };

  const errorRows = result?.details?.filter((d: any) => d.status === "error") || [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Bulk CSV Upload</h1>
      <p className="text-gray-500 mb-6">Upload question-level marks for students in this assessment&apos;s batch.</p>

      <div className="bg-gray-50 border rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">Expected CSV Format</h3>
        <code className="text-sm text-gray-700 block bg-white p-2 rounded border">
          studentId,questionId,score
          <br />
          student-uuid,question-uuid,85
          <br />
          student-uuid,another-question-uuid,90
          <br />
          another-student-uuid,question-uuid,70
        </code>
        <p className="text-xs text-gray-500 mt-2">
          Headers are case-insensitive. One row per student per question.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </button>
          <button
            onClick={() => navigate(`/assessments/${id}`)}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-8 space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">Upload Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-2xl font-bold text-blue-600">{result.totalRows ?? 0}</p>
                <p className="text-xs text-gray-500">Total Rows</p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-2xl font-bold text-green-600">{(result.created ?? 0) + (result.updated ?? 0)}</p>
                <p className="text-xs text-gray-500">Saved / Updated</p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <p className="text-2xl font-bold text-red-600">{result.errors ?? 0}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-red-700 mb-2">Row Errors</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-1">Row</th>
                      <th className="py-1">Student ID</th>
                      <th className="py-1">Question ID</th>
                      <th className="py-1">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((r: any, idx: number) => (
                      <tr key={idx} className="border-b text-red-600">
                        <td className="py-1">{r.row}</td>
                        <td className="py-1 font-mono text-xs">{r.studentId}</td>
                        <td className="py-1 font-mono text-xs">{r.questionId}</td>
                        <td className="py-1">{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default BulkUpload;
