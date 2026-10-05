import { useState, useEffect, useRef } from 'react';
import { getUsers, type UserSummary } from '../services/users.service';

interface UserPickerProps {
  label: string;
  roleId?: string;
  value: string;
  onChange: (userId: string, user?: UserSummary) => void;
  placeholder?: string;
  required?: boolean;
}

export default function UserPicker({ label, roleId, value, onChange, placeholder, required }: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!value) {
      setSelected(null);
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(text: string) {
    setQuery(text);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { search: text.trim(), limit: 10 };
        if (roleId) params.roleId = roleId;
        const data = await getUsers(params as any);
        setResults(data.users);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
  }

  function handleSelect(user: UserSummary) {
    setSelected(user);
    setQuery('');
    setOpen(false);
    onChange(user.id, user);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    onChange('');
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 border rounded px-3 py-1.5 bg-gray-50">
          <span className="text-sm flex-1">
            {selected.name} <span className="text-gray-400">({selected.email})</span>
          </span>
          <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder || `Search by name or email…`}
          className="w-full border rounded px-3 py-1.5 text-sm"
          required={required && !value}
        />
      )}
      {/* Hidden input for form validation */}
      <input type="hidden" value={value} required={required} />
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
            >
              <span className="font-medium">{u.name}</span>
              <span className="text-gray-400 ml-2">{u.email}</span>
              {u.department && <span className="text-gray-300 ml-2">· {u.department}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
