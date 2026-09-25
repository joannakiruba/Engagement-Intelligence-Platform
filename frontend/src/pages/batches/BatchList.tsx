import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBatches, deleteBatch } from "../../services/batches.service";

interface BatchSummary {
  id: string;
  name: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  memberCount: number;
  trainerCount: number;
  sessionCount: number;
}

export default function BatchList() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getBatches();
      setBatches(res.data || []);
    } catch {
      setBatches([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this batch? This cannot be undone.")) return;
    try {
      await deleteBatch(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete batch");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Batches</h1>
        <Link
          to="/batches/create"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Batch
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="text-gray-500">No batches found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Start Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">End Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Members</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Sessions</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/batches/${b.id}`} className="text-blue-600 hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{b.department || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(b.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{b.memberCount}</td>
                  <td className="px-4 py-3 text-sm">{b.sessionCount}</td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <Link
                      to={`/batches/${b.id}/edit`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(b.id)}
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
