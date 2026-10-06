import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getBatches, deleteBatch, type BatchSummary } from "../../services/batches.service";
import { useAuth } from "../../context/AuthContext";

export default function BatchList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page: p, limit };
      if (search.trim()) params.search = search.trim();
      if (department.trim()) params.department = department.trim();
      const res = await getBatches(params as any);
      setBatches(res.batches);
      setTotal(res.total);
      setPage(res.page);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load batches.");
      setBatches([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load(1);
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    load(1);
  }

  async function handleDelete(id: string) {
    setDeletingId(null);
    setError("");
    try {
      await deleteBatch(id);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete batch.");
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
        {isAdmin && (
          <Link
            to="/batches/create"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            + Create Batch
          </Link>
        )}
      </div>

      {/* Search & Filter Bar */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Batch name…"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div className="w-48">
          <label className="block text-xs text-gray-500 mb-1">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Filter by dept…"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          Search
        </button>
        {(search || department) && (
          <button
            type="button"
            onClick={() => { setSearch(""); setDepartment(""); setTimeout(() => load(1), 0); }}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading batches…
        </div>
      ) : batches.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">No batches found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Start Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">End Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Students</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Trainers</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Sessions</th>
                  {isAdmin && <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/batches/${b.id}`} className="text-blue-600 hover:underline font-medium">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.department || "—"}</td>
                    <td className="px-4 py-3 text-sm">{new Date(b.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">{b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-sm">{b.memberCount}</td>
                    <td className="px-4 py-3 text-sm">{b.trainerCount}</td>
                    <td className="px-4 py-3 text-sm">{b.sessionCount}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm">
                        {deletingId === b.id ? (
                          <span className="flex items-center gap-2">
                            <span className="text-red-600 text-xs">Delete?</span>
                            <button onClick={() => handleDelete(b.id)} className="text-red-700 font-medium hover:underline text-xs">Yes</button>
                            <button onClick={() => setDeletingId(null)} className="text-gray-500 hover:underline text-xs">No</button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-3">
                            <Link to={`/batches/${b.id}/edit`} className="text-gray-600 hover:text-gray-900">Edit</Link>
                            <button onClick={() => setDeletingId(b.id)} className="text-red-600 hover:text-red-800">Delete</button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => load(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => load(p)}
                      className={`px-3 py-1 border rounded text-sm ${p === page ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => load(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
