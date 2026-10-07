import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, createEventApi, updateEventApi } from '../../services/events.service';

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [isMandatory, setIsMandatory] = useState(false);
  const [officialLink, setOfficialLink] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState('');
  const [venue, setVenue] = useState('');
  const [fee, setFee] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batches, setBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import('../../services/batches.service').then(mod => {
      const fn = mod.getBatches;
      fn().then((result: any) => {
        const list = Array.isArray(result) ? result : result?.data ?? [];
        setBatches(list);
      }).catch(() => {});
    });

    if (isEdit) {
      getEvent(id).then(ev => {
        setTitle(ev.title);
        setDescription(ev.description || '');
        setCategory(ev.category);
        setIsMandatory(ev.isMandatory);
        setOfficialLink(ev.officialLink || '');
        setStartDate(ev.startDate ? ev.startDate.slice(0, 10) : '');
        setEndDate(ev.endDate ? ev.endDate.slice(0, 10) : '');
        setMode(ev.mode || '');
        setVenue(ev.venue || '');
        setFee(ev.fee != null ? String(ev.fee) : '');
        setSelectedBatchIds(ev.eventBatches?.map(eb => eb.batchId) || []);
      }).catch(() => setError('Failed to load event.'));
    }
  }, [id]);

  function toggleBatch(batchId: string) {
    setSelectedBatchIds(prev => prev.includes(batchId) ? prev.filter(b => b !== batchId) : [...prev, batchId]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const data: Record<string, any> = {};
    if (title) data.title = title;
    if (description) data.description = description;
    if (category) data.category = category;
    data.isMandatory = isMandatory;
    if (officialLink) data.officialLink = officialLink;
    if (startDate) data.startDate = new Date(startDate).toISOString();
    if (endDate) data.endDate = new Date(endDate).toISOString();
    if (mode) data.mode = mode;
    else if (isEdit) data.mode = null;
    if (venue) data.venue = venue;
    if (fee) data.fee = parseFloat(fee);

    try {
      if (isEdit) {
        const ev = await getEvent(id);
        const existing = new Set(ev.eventBatches?.map(eb => eb.batchId) || []);
        const add = selectedBatchIds.filter(b => !existing.has(b));
        if (add.length > 0) data.addBatchIds = add;
        await updateEventApi(id, data);
        navigate(`/events/${id}`);
      } else {
        data.batchIds = selectedBatchIds;
        const created = await createEventApi(data);
        navigate(`/events/${created.id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save event.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Event' : 'Create Event'}</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="OTHER">Other</option>
              <option value="CODING">Coding</option>
              <option value="HACKATHON">Hackathon</option>
            </select>
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="rounded" />
              Mandatory
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Official Link</label>
          <input value={officialLink} onChange={e => setOfficialLink(e.target.value)} type="url" className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Not set</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fee</label>
            <input type="number" value={fee} onChange={e => setFee(e.target.value)} min="0" step="0.01" className="w-full border rounded px-3 py-2 text-sm" placeholder="0" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
          <input value={venue} onChange={e => setVenue(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{isEdit ? 'Add Batches' : 'Target Batches'}</label>
          <p className="text-xs text-gray-500 mb-2">No batches selected = open to all students</p>
          <div className="flex flex-wrap gap-2">
            {batches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBatch(b.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  selectedBatchIds.includes(b.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {b.name}
              </button>
            ))}
            {batches.length === 0 && <span className="text-sm text-gray-400">Loading batches...</span>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Saving...' : (isEdit ? 'Update Event' : 'Create Event')}
          </button>
          <button type="button" onClick={() => navigate('/events')} className="bg-gray-100 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
