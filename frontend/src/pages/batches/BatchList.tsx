import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBatches, deleteBatch } from "../../services/batches.service";
import { useAuth } from "../../context/AuthContext";

interface BatchSummary {
  id: string;
  name: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  memberCount?: number;
  trainerCount?: number;
  sessionCount?: number;
}

export function BatchList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "COORDINATOR";
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getBatches();
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setBatches(list);
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batches &amp; Cohorts</h1>
          <p className="text-sm text-slate-500">Manage student batches, trainer assignments, and scheduling</p>
        </div>
        {isAdmin && (
          <Link
            to="/batches/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-xs"
          >
            + Create Batch
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading batches...</p>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 mb-4">No batches found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sessions</th>
                {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/batches/${b.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{b.department || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {b.startDate ? new Date(b.startDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-slate-700">{b.sessionCount ?? 4}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      <Link
                        to={`/batches/${b.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded bg-indigo-50"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded bg-rose-50"
                      >
                        Delete
                      </button>
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
export default BatchList;
