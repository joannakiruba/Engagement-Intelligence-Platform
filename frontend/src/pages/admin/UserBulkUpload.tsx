import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { bulkCreateUsers, type BulkCsvResult } from '../../services/users.service';

export default function UserBulkUpload() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkCsvResult | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!csvText.trim()) return;

    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const res = await bulkCreateUsers(csvText);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Bulk upload failed.');
      if (err.response?.data?.data) {
        setResult(err.response.data.data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-6 px-4">
      <Link to="/admin/users" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Users</Link>
      <h1 className="text-2xl font-bold mb-6">Bulk CSV Upload</h1>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm">
        <p className="font-medium mb-1">CSV Format</p>
        <p className="text-gray-700">
          Header row required: <code className="bg-white px-1 rounded">name,email,department,year</code>
        </p>
        <p className="text-gray-600 mt-1">
          All users are created with STUDENT role and PENDING status. Activation emails are sent automatically.
        </p>
      </div>

      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="bg-white border rounded p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
          />
          {fileName && <p className="text-xs text-gray-500 mt-1">Selected: {fileName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Or paste CSV content</label>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setResult(null); setError(''); }}
            placeholder={`name,email,department,year\nJohn Doe,john@example.com,CS,2\nJane Smith,jane@example.com,ECE,3`}
            className="w-full border rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !csvText.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {submitting ? 'Uploading…' : 'Upload & Create Users'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          {result.created.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h3 className="font-medium text-green-800 mb-2">
                Created ({result.created.length})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-green-700">
                    <th className="pr-4">Row</th>
                    <th className="pr-4">Email</th>
                    <th>User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {result.created.map((r) => (
                    <tr key={r.userId}>
                      <td className="pr-4">{r.row}</td>
                      <td className="pr-4">{r.email}</td>
                      <td className="font-mono text-xs">
                        <Link to={`/admin/users/${r.userId}`} className="text-blue-600 hover:underline">
                          {r.userId.slice(0, 8)}…
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.rejected.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h3 className="font-medium text-red-800 mb-2">
                Rejected ({result.rejected.length})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-red-700">
                    <th className="pr-4">Row</th>
                    <th className="pr-4">Email</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rejected.map((r, i) => (
                    <tr key={i}>
                      <td className="pr-4">{r.row}</td>
                      <td className="pr-4">{r.email || '—'}</td>
                      <td className="text-red-600">{r.reason}</td>
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
