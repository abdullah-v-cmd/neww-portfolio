import { FormEvent, useState } from 'react';
import { Lock, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { parseJsonSafe } from '../../utils/safeFetch';

interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
  mfa_enabled: boolean;
}

interface AdminAuthGateProps {
  needsBootstrap: boolean;
  hasEnvOverride: boolean;
  onAuthenticated: (token: string, user: AdminUser) => void;
  onExitAdmin: () => void;
}

export function AdminAuthGate({
  needsBootstrap,
  hasEnvOverride,
  onAuthenticated,
  onExitAdmin,
}: AdminAuthGateProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = needsBootstrap ? '/api/admin/auth/bootstrap' : '/api/admin/auth/login';
      const payload = needsBootstrap
        ? { email: email.trim(), displayName: displayName.trim(), password }
        : { email: email.trim(), password, totpCode: mfaRequired ? totpCode.trim() : undefined };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      onAuthenticated(data.token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080B] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0D0F14] p-8 shadow-2xl">
        <button
          type="button"
          onClick={onExitAdmin}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Portfolio</span>
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-600/40 bg-red-600/10 text-red-400">
            {needsBootstrap ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">
              {needsBootstrap ? 'Initial Owner Setup' : 'Admin Control Center'}
            </h1>
            <p className="text-xs text-slate-400">
              {needsBootstrap
                ? 'Provision the primary owner credentials (one-time lock).'
                : 'Restricted administrative portal · Enter both email and password.'}
            </p>
          </div>
        </div>

        {hasEnvOverride && !needsBootstrap ? (
          <div className="mb-5 rounded-lg border border-blue-900/50 bg-blue-950/30 p-3 text-xs text-blue-200">
            Environment owner override is active. Sign in using your configured admin credentials.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div>
            <label htmlFor="admin-login-email" className="mb-1.5 block text-xs font-medium text-slate-300">
              Admin Email
            </label>
            <input
              id="admin-login-email"
              name="admin-login-email"
              type="email"
              required
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email address"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
            />
          </div>

          {needsBootstrap ? (
            <div>
              <label htmlFor="admin-display-name" className="mb-1.5 block text-xs font-medium text-slate-300">
                Display Name
              </label>
              <input
                id="admin-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full Name"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="admin-login-password" className="mb-1.5 block text-xs font-medium text-slate-300">
              {needsBootstrap ? 'Choose Owner Password (min 10 chars)' : 'Password'}
            </label>
            <input
              id="admin-login-password"
              name="admin-login-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={needsBootstrap ? 10 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
            />
          </div>

          {mfaRequired ? (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>6-Digit Authenticator Code (TOTP)</span>
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                className="h-10 w-full rounded-lg border border-emerald-700 bg-[#07080B] px-3 font-mono text-sm tracking-widest text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {loading
              ? 'Verifying...'
              : needsBootstrap
                ? 'Provision Owner Account'
                : mfaRequired
                  ? 'Verify Code & Enter'
                  : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
