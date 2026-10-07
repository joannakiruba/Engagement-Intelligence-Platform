// src/pages/auth/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { getErrorMessage } from '../../services/api';


export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submitCredentials();
  }

  async function submitCredentials() {
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      const from = location.state?.from;
      navigate(from?.pathname ? from.pathname + (from.search || '') + (from.hash || '') : '/', { replace: true });
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

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
        <Link to="/forgot-password" className="block text-center text-sm text-indigo-600">Forgot your password?</Link>


      </div>
    </div>
  );
}
export default LoginPage;
