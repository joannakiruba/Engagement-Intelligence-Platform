import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createBatch, getBatch, updateBatch } from "../../services/batches.service";

export default function BatchCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setLoadingBatch(true);
      getBatch(id)
        .then((b) => {
          setName(b.name);
          setDepartment(b.department || "");
          setStartDate(b.startDate?.split("T")[0] || "");
          setEndDate(b.endDate?.split("T")[0] || "");
          setDescription(b.description || "");
        })
        .catch((err: any) => {
          setError(err.response?.data?.error || "Failed to load batch.");
        })
        .finally(() => setLoadingBatch(false));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: Record<string, string | undefined> = {
        name,
        startDate: new Date(startDate).toISOString(),
      };
      if (department) payload.department = department;
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (description) payload.description = description;

      if (isEdit) {
        await updateBatch(id, payload);
      } else {
        await createBatch(payload as any);
      }
      navigate("/batches");
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        "An error occurred";
      setError(msg);
    }
    setSubmitting(false);
  };

  if (loadingBatch) {
    return (
      <div className="max-w-2xl py-8">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading batch…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link to="/batches" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Batches</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Edit" : "Create"} Batch</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? "Saving…" : isEdit ? "Update Batch" : "Create Batch"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/batches")}
            className="border px-6 py-2 rounded hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
