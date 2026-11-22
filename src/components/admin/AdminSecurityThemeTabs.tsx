import { FormEvent, useEffect, useState } from 'react';
import { Save, Shield, Download, LogOut, Upload, Film } from 'lucide-react';
import { parseJsonSafe } from '../../utils/safeFetch';

interface AdminSecurityThemeTabsProps {
  mode: 'theme' | 'security';
  token: string;
  adminEmail: string;
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
  adminEmail,
  theme,
  sessions,
  auditLogs,
  mfaEnabled,
  onReload,
  notify,
}: AdminSecurityThemeTabsProps) {
  const [themeForm, setThemeForm] = useState<any>(theme || {});
  const [uploadingField, setUploadingField] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(adminEmail || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (adminEmail) setNewEmail(adminEmail);
  }, [adminEmail]);

  useEffect(() => {
    if (theme) setThemeForm(theme);
  }, [theme]);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const handleUploadMedia = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/theme/upload-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Media upload failed');
      setThemeForm((prev: any) => ({ ...prev, [field]: data.url }));
      notify(`Uploaded ${field.replace('bg_', '').replace(/_/g, ' ')} successfully. Save Visual Settings to publish.`);
    } catch (err: any) {
      notify(err?.message || 'Media upload failed.');
    } finally {
      setUploadingField('');
    }
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
        notify('Theme, Video Background, RAG & SEO settings saved.');
      }
    };

    return (
      <form onSubmit={handleSaveTheme} className="space-y-6">
        <div className="space-y-5 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">
                Theme, Cinematic Video Background &amp; SEO
              </h3>
              <p className="text-xs text-slate-400">
                Control ambient hero video/image/gradient modes, 3D WebGL scene, intro sequence, and RAG retrieval tuning.
              </p>
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
                onChange={(e) =>
                  setThemeForm({ ...themeForm, profile_selector_enabled: e.target.checked ? 1 : 0 })
                }
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
        </div>

        {/* Hero Background & Cinematic Video Settings */}
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Film className="h-4 w-4 text-red-400" />
            <h4 className="font-display text-base font-semibold text-white">
              Background &amp; Cinematic Video Settings
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Active Hero Background Mode</label>
              <select
                value={themeForm.bg_mode || 'default'}
                onChange={(e) => setThemeForm({ ...themeForm, bg_mode: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
              >
                <option value="default">Default Dark Cinema 3D Scene</option>
                <option value="gradient">Custom Ambient Gradient</option>
                <option value="image">Full-Bleed Image Backdrop</option>
                <option value="video">Seamless Looping Video (MP4 / WebM)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Dark Contrast Overlay Scrim ({Math.round((themeForm.bg_overlay_opacity ?? 0.72) * 100)}%)
              </label>
              <input
                type="range"
                min={0.2}
                max={0.95}
                step={0.05}
                value={themeForm.bg_overlay_opacity ?? 0.72}
                onChange={(e) =>
                  setThemeForm({ ...themeForm, bg_overlay_opacity: parseFloat(e.target.value) })
                }
                className="mt-2 w-full accent-red-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
              <p className="text-xs font-medium text-white">Desktop Background Video (MP4 / WebM, max 40MB)</p>
              <input
                type="text"
                value={themeForm.bg_video_url || ''}
                onChange={(e) => setThemeForm({ ...themeForm, bg_video_url: e.target.value })}
                placeholder="/uploads/public/bg_...mp4 or HTTPS URL"
                className="h-9 w-full rounded border border-zinc-800 bg-[#0D0F14] px-2.5 font-mono text-xs text-white"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingField === 'bg_video_url' ? 'Uploading…' : 'Upload Desktop Video'}</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleUploadMedia('bg_video_url', e.target.files[0])}
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
              <p className="text-xs font-medium text-white">Mobile Video Variant (Optional lightweight MP4/WebM)</p>
              <input
                type="text"
                value={themeForm.bg_mobile_video_url || ''}
                onChange={(e) => setThemeForm({ ...themeForm, bg_mobile_video_url: e.target.value })}
                placeholder="/uploads/public/bg_mobile_...mp4"
                className="h-9 w-full rounded border border-zinc-800 bg-[#0D0F14] px-2.5 font-mono text-xs text-white"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploadingField === 'bg_mobile_video_url' ? 'Uploading…' : 'Upload Mobile Video'}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="sr-only"
                  onChange={(e) =>
                    e.target.files?.[0] && handleUploadMedia('bg_mobile_video_url', e.target.files[0])
                  }
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
              <p className="text-xs font-medium text-white">Poster / Reduced-Motion Fallback Image</p>
              <input
                type="text"
                value={themeForm.bg_poster_url || ''}
                onChange={(e) => setThemeForm({ ...themeForm, bg_poster_url: e.target.value })}
                placeholder="/uploads/public/poster.jpg"
                className="h-9 w-full rounded border border-zinc-800 bg-[#0D0F14] px-2.5 font-mono text-xs text-white"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingField === 'bg_poster_url' ? 'Uploading…' : 'Upload Poster Image'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleUploadMedia('bg_poster_url', e.target.files[0])}
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
              <p className="text-xs font-medium text-white">Background Image (Image Mode)</p>
              <input
                type="text"
                value={themeForm.bg_image_url || ''}
                onChange={(e) => setThemeForm({ ...themeForm, bg_image_url: e.target.value })}
                placeholder="/uploads/public/bg_image.jpg"
                className="h-9 w-full rounded border border-zinc-800 bg-[#0D0F14] px-2.5 font-mono text-xs text-white"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingField === 'bg_image_url' ? 'Uploading…' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleUploadMedia('bg_image_url', e.target.files[0])}
                />
              </label>
            </div>
          </div>

          {themeForm.bg_mode === 'video' && themeForm.bg_video_url ? (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
              <p className="border-b border-zinc-800 px-3 py-1.5 font-mono text-[11px] text-slate-400">
                Live Video Preview
              </p>
              <video
                src={themeForm.bg_video_url}
                poster={themeForm.bg_poster_url || undefined}
                autoPlay
                muted
                loop
                playsInline
                className="h-44 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {/* RAG Pipeline Configuration */}
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <h4 className="font-display text-base font-semibold text-white">RAG Retrieval Tuning</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Top-K Chunks (3 – 12)</label>
              <input
                type="number"
                min={3}
                max={12}
                value={themeForm.rag_top_k ?? 6}
                onChange={(e) => setThemeForm({ ...themeForm, rag_top_k: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Chunk Size (chars)</label>
              <input
                type="number"
                min={350}
                max={2000}
                value={themeForm.rag_chunk_size ?? 800}
                onChange={(e) => setThemeForm({ ...themeForm, rag_chunk_size: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Lexical vs Semantic Weight (0.2 – 0.95)</label>
              <input
                type="number"
                min={0.2}
                max={0.95}
                step={0.05}
                value={themeForm.rag_hybrid_weight ?? 0.65}
                onChange={(e) =>
                  setThemeForm({ ...themeForm, rag_hybrid_weight: parseFloat(e.target.value) })
                }
                className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
              />
            </div>
          </div>
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
    const d = await parseJsonSafe<any>(res);
    if (!res.ok) return notify(d.error || 'Password change failed.');
    setCurrentPassword('');
    setNewPassword('');
    await onReload();
    notify('Password updated and other sessions invalidated.');
  };

  const handleChangeEmail = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/auth/change-email', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ newEmail, currentPassword: emailPassword }),
    });
    const d = await parseJsonSafe<any>(res);
    if (!res.ok) return notify(d.error || 'Email update failed.');
    setEmailPassword('');
    await onReload();
    notify(`Admin login email updated to ${d.email}.`);
  };

  const handleStartMfa = async () => {
    const res = await fetch('/api/admin/auth/mfa/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await parseJsonSafe<any>(res);
    if (!res.ok) return notify(d.error || 'MFA setup failed.');
    setMfaSetup(d);
  };

  const handleEnableMfa = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/auth/mfa/enable', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: mfaCode }),
    });
    const d = await parseJsonSafe<any>(res);
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

  const handleBackupRestore = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(parsed),
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Restore failed.');
      await onReload();
      notify('Profile & theme restored cleanly from backup JSON.');
    } catch (err: any) {
      notify(err?.message || 'Invalid backup file.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        <form onSubmit={handleChangeEmail} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Change Admin Login Email</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Current login: <span className="font-mono text-slate-200">{adminEmail || '—'}</span>
            </p>
          </div>
          <input
            type="email"
            required
            placeholder="New Admin Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="password"
            required
            placeholder="Verify Current Password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            Update Admin Email
          </button>
        </form>

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

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleBackupDownload}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-white hover:border-zinc-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON Backup</span>
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-white hover:border-zinc-500">
              <Upload className="h-3.5 w-3.5" />
              <span>Restore from Backup JSON</span>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => e.target.files?.[0] && handleBackupRestore(e.target.files[0])}
                className="sr-only"
              />
            </label>
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
