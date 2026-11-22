import { FormEvent, useEffect, useState } from 'react';
import {
  FileCheck2,
  Send,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Star,
  Plus,
  Search,
} from 'lucide-react';
import { CvRequestItem, ResumeVersionItem } from '../../types/portfolio';
import { parseJsonSafe } from '../../utils/safeFetch';

interface AdminCvRequestsTabProps {
  token: string;
  cvRequests: CvRequestItem[];
  resumes: ResumeVersionItem[];
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminCvRequestsTab({
  token,
  cvRequests,
  resumes,
  onReload,
  notify,
}: AdminCvRequestsTabProps) {
  const [subTab, setSubTab] = useState<'requests' | 'resumes'>('requests');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReqId, setSelectedReqId] = useState<number>(cvRequests[0]?.id || 0);

  // Selected request editable notes & delivery composer
  const [notesDraft, setNotesDraft] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('Abdullah Naveed — Requested CV');
  const [emailBody, setEmailBody] = useState('');
  const [cvSourceMode, setCvSourceMode] = useState<'saved' | 'upload'>('saved');
  const [selectedVersionId, setSelectedVersionId] = useState<number>(0);
  const [customPdf, setCustomPdf] = useState<File | null>(null);
  const [saveAsVersion, setSaveAsVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'attachment' | 'link'>('attachment');
  const [sendingCv, setSendingCv] = useState(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Resume version upload state
  const [rvName, setRvName] = useState('');
  const [rvDesc, setRvDesc] = useState('');
  const [rvScope, setRvScope] = useState<'recruiter' | 'public'>('recruiter');
  const [rvDefault, setRvDefault] = useState(true);
  const [rvFile, setRvFile] = useState<File | null>(null);
  const [uploadingRv, setUploadingRv] = useState(false);

  const filteredRequests = cvRequests.filter((r) => {
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchText =
      !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.request_uid.toLowerCase().includes(q);
    return matchStatus && matchText;
  });

  const activeReq =
    filteredRequests.find((r) => r.id === selectedReqId) || filteredRequests[0] || null;

  useEffect(() => {
    if (cvRequests.length > 0 && !cvRequests.some((r) => r.id === selectedReqId)) {
      setSelectedReqId(cvRequests[0].id);
    }
  }, [cvRequests, selectedReqId]);

  useEffect(() => {
    if (!activeReq) return;
    setNotesDraft(activeReq.internal_notes || '');
    setRecipientEmail(activeReq.email || '');
    setEmailSubject(`Abdullah Naveed — Requested CV (${activeReq.company})`);
    setEmailBody(
      `Hello ${activeReq.full_name},\n\nThank you for reaching out regarding opportunities at ${activeReq.company}${
        activeReq.job_title ? ` (${activeReq.job_title})` : ''
      }. Please find my CV attached as requested.\n\nI look forward to connecting.\n\nBest regards,\nAbdullah Naveed`
    );
    setDeliveryFeedback(null);
  }, [activeReq?.id]);

  useEffect(() => {
    const activeDefault = resumes.find((r) => r.is_default && !r.is_archived) || resumes.find((r) => !r.is_archived);
    if (activeDefault && (!selectedVersionId || !resumes.some((r) => r.id === selectedVersionId))) {
      setSelectedVersionId(activeDefault.id);
    }
  }, [resumes, selectedVersionId]);

  const handleUpdateRequest = async (id: number, nextStatus?: string) => {
    const res = await fetch(`/api/admin/cv-requests/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: nextStatus || activeReq?.status,
        internal_notes: notesDraft,
      }),
    });
    if (res.ok) {
      await onReload();
      notify('CV request updated.');
    }
  };

  const handleSendCv = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeReq || sendingCv) return;
    setSendingCv(true);
    setDeliveryFeedback(null);

    try {
      const fd = new FormData();
      fd.append('recipientEmail', recipientEmail.trim());
      fd.append('subject', emailSubject.trim());
      fd.append('emailBody', emailBody.trim());
      fd.append('deliveryMethod', deliveryMethod);
      fd.append('idempotencyKey', `${activeReq.id}_${Date.now()}`);

      if (cvSourceMode === 'upload') {
        if (!customPdf) {
          throw new Error('Select a PDF file to attach or switch to a saved CV version.');
        }
        fd.append('file', customPdf);
        fd.append('saveAsVersion', String(saveAsVersion));
        if (newVersionName.trim()) fd.append('newVersionName', newVersionName.trim());
      } else {
        if (!selectedVersionId) {
          throw new Error('No saved resume version selected. Upload a CV PDF first.');
        }
        fd.append('resumeVersionId', String(selectedVersionId));
      }

      const res = await fetch(`/api/admin/cv-requests/${activeReq.id}/send-cv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await parseJsonSafe<any>(res);
      await onReload();

      if (!res.ok || !data.ok) {
        const msg = data.error || 'SMTP delivery failed.';
        setDeliveryFeedback({ ok: false, msg });
        notify(`Delivery Failed: ${msg}`);
      } else {
        setDeliveryFeedback({ ok: true, msg: data.message });
        setCustomPdf(null);
        notify(data.message);
      }
    } catch (err: any) {
      setDeliveryFeedback({ ok: false, msg: err?.message || 'Send request failed.' });
    } finally {
      setSendingCv(false);
    }
  };

  const handleCreateResumeVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!rvFile) return;
    setUploadingRv(true);
    try {
      const fd = new FormData();
      fd.append('file', rvFile);
      fd.append('versionName', rvName.trim() || rvFile.name.replace(/\.pdf$/i, ''));
      fd.append('description', rvDesc.trim());
      fd.append('scope', rvScope);
      fd.append('isDefault', String(rvDefault));

      const res = await fetch('/api/admin/resumes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setRvName('');
      setRvDesc('');
      setRvFile(null);
      await onReload();
      notify('Resume PDF version saved.');
    } catch (err: any) {
      notify(err?.message || 'Resume upload failed.');
    } finally {
      setUploadingRv(false);
    }
  };

  const handlePreviewResume = async (rv: ResumeVersionItem) => {
    const res = await fetch(`/api/admin/resumes/${rv.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      notify('Resume PDF file not available on disk.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rv.filename || `${rv.version_name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('requests')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'requests'
                ? 'bg-red-600 text-white'
                : 'border border-zinc-800 bg-[#07080B] text-slate-300 hover:text-white'
            }`}
          >
            Recruiter CV Requests ({cvRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('resumes')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'resumes'
                ? 'bg-red-600 text-white'
                : 'border border-zinc-800 bg-[#07080B] text-slate-300 hover:text-white'
            }`}
          >
            Resume Versions ({resumes.filter((r) => !r.is_archived).length})
          </button>
        </div>
        <p className="text-xs text-slate-400">
          SMTP sends real attachments or 7-day expiring download links. Status only becomes &ldquo;CV Sent&rdquo; after verified SMTP acceptance.
        </p>
      </div>

      {subTab === 'resumes' ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateResumeVersion} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
            <h3 className="font-display text-base font-semibold text-white">Upload New Resume / CV PDF Version</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                placeholder="Version Name (e.g. AI Engineer CV 2026)"
                value={rvName}
                onChange={(e) => setRvName(e.target.value)}
                className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
              />
              <select
                value={rvScope}
                onChange={(e) => setRvScope(e.target.value as 'recruiter' | 'public')}
                className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
              >
                <option value="recruiter">Private Recruiter Delivery Only</option>
                <option value="public">Public + Recruiter Download</option>
              </select>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-[#07080B] px-3 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{rvFile ? rvFile.name : 'Choose PDF File *'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setRvFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Notes / Target Role (e.g. Tailored for RAG & LLM Engineering roles)"
                value={rvDesc}
                onChange={(e) => setRvDesc(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rvDefault}
                  onChange={(e) => setRvDefault(e.target.checked)}
                />
                <span>Set as Default CV</span>
              </label>
              <button
                type="submit"
                disabled={uploadingRv || !rvFile}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{uploadingRv ? 'Uploading…' : 'Upload CV Version'}</span>
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0D0F14]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-slate-400">
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {resumes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No CV versions uploaded yet. Upload your first PDF above.
                    </td>
                  </tr>
                ) : (
                  resumes.map((rv) => (
                    <tr key={rv.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{rv.version_name}</p>
                        <p className="text-[11px] text-slate-400">{rv.description || '—'}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{rv.scope}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{rv.filename}</td>
                      <td className="px-4 py-3 font-mono">
                        {rv.is_default ? (
                          <span className="text-emerald-400">Default Active</span>
                        ) : rv.is_archived ? (
                          <span className="text-slate-500">Archived</span>
                        ) : (
                          <span className="text-slate-300">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewResume(rv)}
                            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-slate-200 hover:border-zinc-500"
                          >
                            <Download className="h-3 w-3" />
                            <span>Download</span>
                          </button>
                          {!rv.is_default ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/admin/resumes/${rv.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ is_default: true, is_active: true, is_archived: false }),
                                });
                                await onReload();
                                notify(`Set ${rv.version_name} as default CV.`);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-amber-700/60 px-2.5 py-1 text-amber-300 hover:bg-amber-950/30"
                            >
                              <Star className="h-3 w-3" />
                              <span>Default</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/admin/resumes/${rv.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              await onReload();
                              notify('Resume version removed.');
                            }}
                            className="text-slate-500 hover:text-red-400"
                            title="Delete CV version"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Request List */}
          <div className="space-y-3 lg:col-span-5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search recruiter, company, ID..."
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#0D0F14] pl-8 pr-3 text-xs text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-zinc-800 bg-[#0D0F14] px-2.5 text-xs text-white"
              >
                {['All', 'New Request', 'Under Review', 'Approved', 'CV Sent', 'Rejected', 'Closed'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 text-center text-xs text-slate-400">
                No CV requests match the selected filter.
              </div>
            ) : (
              <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {filteredRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedReqId(req.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      activeReq?.id === req.id
                        ? 'border-red-600/70 bg-[#121620]'
                        : 'border-zinc-800 bg-[#0D0F14] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">{req.request_uid}</span>
                      <span
                        className={
                          req.status === 'CV Sent'
                            ? 'text-emerald-400'
                            : req.delivery_status === 'Failed'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {req.full_name} · {req.company}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {req.email}{req.job_title ? ` · ${req.job_title}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail + Delivery Composer */}
          <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 lg:col-span-7">
            {activeReq ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                      <FileCheck2 className="h-3.5 w-3.5 text-red-400" />
                      <span>{activeReq.request_uid}</span>
                      <span>·</span>
                      <span>Submitted {activeReq.created_at}</span>
                    </div>
                    <h3 className="mt-1 font-display text-2xl font-bold text-white">
                      {activeReq.full_name} — {activeReq.company}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {activeReq.email} {activeReq.job_title ? `· Role: ${activeReq.job_title}` : ''}
                    </p>
                  </div>

                  <select
                    value={activeReq.status}
                    onChange={(e) => handleUpdateRequest(activeReq.id, e.target.value)}
                    className="h-9 rounded-lg border border-zinc-700 bg-[#07080B] px-3 text-xs text-white"
                  >
                    {['New Request', 'Under Review', 'Approved', 'CV Sent', 'Rejected', 'Closed'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {activeReq.message ? (
                  <div className="rounded-lg border border-zinc-800 bg-[#07080B] p-4">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Recruiter Message
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-200">{activeReq.message}</p>
                  </div>
                ) : null}

                {/* Internal Admin Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Internal Admin Notes</label>
                    <button
                      type="button"
                      onClick={() => handleUpdateRequest(activeReq.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Save Notes
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Private notes about this recruiter / company..."
                    className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-2.5 text-xs text-white"
                  />
                </div>

                {/* Email Attachment / Link Delivery Composer */}
                <form onSubmit={handleSendCv} className="space-y-4 border-t border-zinc-800 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display text-base font-semibold text-white">
                      Send CV via Email
                    </h4>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setCvSourceMode('saved')}
                        className={`rounded-md px-3 py-1 font-medium ${
                          cvSourceMode === 'saved' ? 'bg-zinc-800 text-white' : 'text-slate-400'
                        }`}
                      >
                        Saved CV Version
                      </button>
                      <button
                        type="button"
                        onClick={() => setCvSourceMode('upload')}
                        className={`rounded-md px-3 py-1 font-medium ${
                          cvSourceMode === 'upload' ? 'bg-zinc-800 text-white' : 'text-slate-400'
                        }`}
                      >
                        Upload Custom PDF
                      </button>
                    </div>
                  </div>

                  {cvSourceMode === 'saved' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Select CV PDF</label>
                        <select
                          value={selectedVersionId}
                          onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                          className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                        >
                          {resumes.filter((r) => !r.is_archived).length === 0 ? (
                            <option value={0}>No saved versions — switch to Upload Custom PDF</option>
                          ) : null}
                          {resumes
                            .filter((r) => !r.is_archived)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.version_name} ({r.filename})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Delivery Mode</label>
                        <select
                          value={deliveryMethod}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'attachment' | 'link')}
                          className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                        >
                          <option value="attachment">Attach PDF Directly in Email</option>
                          <option value="link">Secure 7-Day Expiring Download Link</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white hover:border-zinc-500">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{customPdf ? customPdf.name : 'Choose Custom PDF Attachment *'}</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setCustomPdf(e.target.files?.[0] || null)}
                            className="sr-only"
                          />
                        </label>
                        <select
                          value={deliveryMethod}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'attachment' | 'link')}
                          className="h-9 rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 text-xs text-white"
                        >
                          <option value="attachment">Attach Directly</option>
                          <option value="link">7-Day Secure Link</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={saveAsVersion}
                            onChange={(e) => setSaveAsVersion(e.target.checked)}
                          />
                          <span>Also save to Resume Versions</span>
                        </label>
                        {saveAsVersion ? (
                          <input
                            type="text"
                            placeholder="Optional version label"
                            value={newVersionName}
                            onChange={(e) => setNewVersionName(e.target.value)}
                            className="h-8 flex-1 rounded border border-zinc-800 bg-[#0D0F14] px-2.5 text-xs text-white"
                          />
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Recipient Email</label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Email Subject</label>
                      <input
                        type="text"
                        required
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Editable Email Body</label>
                    <textarea
                      rows={5}
                      required
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-xs leading-relaxed text-white"
                    />
                  </div>

                  {deliveryFeedback ? (
                    <div
                      className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                        deliveryFeedback.ok
                          ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
                          : 'border-red-800/60 bg-red-950/30 text-red-200'
                      }`}
                    >
                      {deliveryFeedback.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <span>{deliveryFeedback.msg}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingCv}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{sendingCv ? 'Sending via SMTP…' : 'Send CV Email'}</span>
                    </button>
                  </div>
                </form>

                {/* Delivery Audit Trail */}
                {activeReq.delivery_logs?.length > 0 ? (
                  <div className="border-t border-zinc-800 pt-4">
                    <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                      Delivery Attempt History
                    </h4>
                    <div className="space-y-2">
                      {activeReq.delivery_logs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-lg border border-zinc-800 bg-[#07080B] px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-white">
                              Attempt #{log.attempt_number} · {log.recipient_email}
                            </span>
                            <span
                              className={
                                log.delivery_status === 'Failed'
                                  ? 'font-mono text-red-400'
                                  : 'font-mono text-emerald-400'
                              }
                            >
                              {log.delivery_status}
                            </span>
                          </div>
                          {log.error_message ? (
                            <p className="mt-1 text-[11px] text-red-300">{log.error_message}</p>
                          ) : null}
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            By {log.sent_by_admin} · {log.created_at}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a recruiter CV request to inspect or deliver.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
