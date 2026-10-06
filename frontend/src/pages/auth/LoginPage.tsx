// src/pages/auth/LoginPage.tsx
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { RoleName } from '../../types';

const PERSONAS: { role: RoleName; name: string; email: string; desc: string }[] = [
  { role: 'STUDENT', name: 'Aanya Sharma', email: 'student@hope.dev', desc: 'Attendance, marks, proofs & tasks' },
  { role: 'TRAINER', name: 'Rajesh Kumar', email: 'trainer@hope.dev', desc: '8:05 AM QR window, tests & feedback' },
  { role: 'MENTOR', name: 'Dr. Anand Rao', email: 'mentor@hope.dev', desc: 'Disengagement alerts & interventions' },
  { role: 'FACULTY', name: 'Prof. Ramesh Nair', email: 'faculty@hope.dev', desc: 'Academic oversight & batch trends' },
  { role: 'COORDINATOR', name: 'Coordinator User', email: 'coordinator@hope.dev', desc: 'Placement readiness & proof approvals' },
  { role: 'ADMIN', name: 'Admin User', email: 'admin@hope.dev', desc: 'System-wide RBAC, users & batches' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('student@hope.dev');
  const [password, setPassword] = useState('HopeTest2026!@dev');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Login failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleQuickLogin = async (personaEmail: string) => {
    setEmail(personaEmail);
    setError('');
    setSubmitting(true);
    try {
      await login(personaEmail, 'HopeTest2026!@dev');
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Quick sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">HOPE Platform Sign In</h1>
          <p className="text-xs text-slate-500">
            Student Engagement &amp; Intervention Intelligence Platform
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="email" className="block font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* 1-Click Persona Sign-In Grid */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-2.5">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800">1-Click Demo Personas (All 6 Roles)</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-left">
            {PERSONAS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => handleQuickLogin(p.email)}
                disabled={submitting}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-900 group-hover:text-indigo-700">
                    {p.role}
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-indigo-500">→</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
