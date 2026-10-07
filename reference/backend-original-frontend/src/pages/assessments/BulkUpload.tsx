import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { bulkUploadScores } from "../../services/assessments.service";

export default function BulkUpload() {
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
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    }
    setUploading(false);
  };

  const errorRows = result?.details?.filter((d: any) => d.status === "error") || [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Bulk CSV Upload</h1>
      <p className="text-gray-500 mb-6">Upload question-level scores via CSV</p>

      <div className="bg-gray-50 border rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">Expected CSV Format</h3>
        <code className="text-sm text-gray-700 block bg-white p-2 rounded border">
          studentId,questionId,score
          <br />
          uuid-1,uuid-a,85
          <br />
          uuid-1,uuid-b,90
          <br />
          uuid-2,uuid-a,70
        </code>
        <p className="text-xs text-gray-500 mt-2">
          Headers are case-insensitive. One row per student per question.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border rounded px-3 py-2"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button
          onClick={() => navigate(`/assessments/${id}`)}
          className="border px-4 py-2 rounded hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {result && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-white border rounded p-3 text-center">
              <div className="text-2xl font-bold">{result.total}</div>
              <div className="text-sm text-gray-500">Total Rows</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{result.created}</div>
              <div className="text-sm text-gray-500">Created</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
              <div className="text-sm text-gray-500">Updated</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{result.errors}</div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-red-600">Errors</h3>
              <table className="w-full bg-white border rounded text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Row</th>
                    <th className="text-left px-3 py-2">Student ID</th>
                    <th className="text-left px-3 py-2">Question ID</th>
                    <th className="text-left px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.map((r: any) => (
                    <tr key={r.row} className="border-t">
                      <td className="px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.studentId || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.questionId || "-"}</td>
                      <td className="px-3 py-2 text-red-600">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
