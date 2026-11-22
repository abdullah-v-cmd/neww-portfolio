import { FormEvent, useState } from 'react';
import { Save, Shield, Download, LogOut } from 'lucide-react';

interface AdminSecurityThemeTabsProps {
  mode: 'theme' | 'security';
  token: string;
  theme: any;
  sessions: any[];
  auditLogs: any[];
  mfaEnabled: boolean;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminSecurityThemeTabs({
  mode,
  token,
  theme,
  sessions,
  auditLogs,
  mfaEnabled,
  onReload,
  notify,
}: AdminSecurityThemeTabsProps) {
  const [themeForm, setThemeForm] = useState<any>(theme || {});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (mode === 'theme') {
    const handleSaveTheme = async (e: FormEvent) => {
      e.preventDefault();
      const res = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(themeForm),
      });
      if (res.ok) {
        await onReload();
        notify('Visual, animation, and SEO settings saved.');
      }
    };

    return (
      <form onSubmit={handleSaveTheme} className="space-y-5 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">Theme, Motion &amp; SEO Settings</h3>
            <p className="text-xs text-slate-400">Control 3D WebGL scene, intro sequence, profile selector, and SEO metadata.</p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Visual Settings</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Primary Accent Color</label>
            <input
              type="text"
              value={themeForm.accent_color || '#dc2626'}
              onChange={(e) => setThemeForm({ ...themeForm, accent_color: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">SEO Page Title</label>
            <input
              type="text"
              value={themeForm.seo_title || ''}
              onChange={(e) => setThemeForm({ ...themeForm, seo_title: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">SEO Meta Description</label>
            <textarea
              rows={2}
              value={themeForm.seo_description || ''}
              onChange={(e) => setThemeForm({ ...themeForm, seo_description: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 rounded-lg border border-zinc-800 bg-[#07080B] p-4 text-sm text-slate-200">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(themeForm.intro_enabled)}
              onChange={(e) => setThemeForm({ ...themeForm, intro_enabled: e.target.checked ? 1 : 0 })}
            />
            <span>Enable Cinematic Intro</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(themeForm.profile_selector_enabled)}
              onChange={(e) => setThemeForm({ ...themeForm, profile_selector_enabled: e.target.checked ? 1 : 0 })}
            />
            <span>Enable Profile Selector</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(themeForm.three_d_enabled)}
              onChange={(e) => setThemeForm({ ...themeForm, three_d_enabled: e.target.checked ? 1 : 0 })}
            />
            <span>Enable 3D Hero Scene</span>
          </label>
        </div>
      </form>
    );
  }

  // Security, MFA, Sessions, Audit Logs & Backups
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || 'Password change failed.');
    setCurrentPassword('');
    setNewPassword('');
    await onReload();
    notify('Password updated and other sessions invalidated.');
  };

  const handleStartMfa = async () => {
    const res = await fetch('/api/admin/auth/mfa/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMfaSetup(await res.json());
  };

  const handleEnableMfa = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/auth/mfa/enable', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: mfaCode }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || 'Invalid MFA code.');
    setMfaSetup(null);
    setMfaCode('');
    await onReload();
    notify('Two-Factor Authentication (TOTP) enabled.');
  };

  const handleBackupDownload = async () => {
    const res = await fetch('/api/admin/backup/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abdullah-portfolio-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Database JSON backup exported.');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Password Rotation */}
        <form onSubmit={handleChangePassword} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <h3 className="font-display text-base font-semibold text-white">Rotate Admin Password</h3>
          <input
            type="password"
            required
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="password"
            required
            minLength={10}
            placeholder="New Password (min 10 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            Update Password
          </button>
        </form>

        {/* TOTP MFA + Backup */}
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-white">Multi-Factor Auth (TOTP)</h3>
              <p className="text-xs text-slate-400">
                Status: <span className="font-mono text-white">{mfaEnabled ? 'Enabled' : 'Disabled'}</span>
              </p>
            </div>
            <Shield className="h-5 w-5 text-red-400" />
          </div>

          {!mfaEnabled && !mfaSetup ? (
            <button
              type="button"
              onClick={handleStartMfa}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-white hover:border-zinc-500"
            >
              Configure Authenticator App
            </button>
          ) : null}

          {mfaSetup ? (
            <form onSubmit={handleEnableMfa} className="space-y-3">
              <img src={mfaSetup.qrDataUrl} alt="MFA QR Code" className="h-36 w-36 rounded-lg bg-white p-2" />
              <p className="font-mono text-xs text-slate-400">Secret: {mfaSetup.secret}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="h-9 rounded-lg border border-zinc-800 bg-[#07080B] px-3 font-mono text-sm text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white"
                >
                  Verify &amp; Enable
                </button>
              </div>
            </form>
          ) : null}

          <div className="border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleBackupDownload}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-white hover:border-zinc-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Portfolio JSON Backup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">Active Admin Sessions</h3>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/auth/logout-all', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              window.location.reload();
            }}
            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Revoke All Sessions</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-slate-400">
                <th className="pb-2">Session</th>
                <th className="pb-2">User Agent</th>
                <th className="pb-2">Expires</th>
                <th className="pb-2 text-right">Revoke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 font-mono text-slate-200">
                    #{s.id} {s.is_current ? '(Current)' : ''} {s.revoked ? '(Revoked)' : ''}
                  </td>
                  <td className="max-w-xs truncate py-2 text-slate-400">{s.user_agent}</td>
                  <td className="py-2 font-mono text-slate-400">{s.expires_at}</td>
                  <td className="py-2 text-right">
                    {!s.revoked ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/auth/sessions/${s.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          await onReload();
                        }}
                        className="text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
        <h3 className="font-display text-base font-semibold text-white">Security Audit Log</h3>
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-slate-400">
                <th className="pb-2">Actor</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Details</th>
                <th className="pb-2 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-slate-300">{l.actor_email}</td>
                  <td className="py-2 font-mono text-red-400">{l.action}</td>
                  <td className="py-2 text-slate-400">{l.details || l.resource_type}</td>
                  <td className="py-2 text-right font-mono text-slate-500">{l.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
