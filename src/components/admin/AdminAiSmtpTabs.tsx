import { FormEvent, useEffect, useState } from 'react';
import { RefreshCw, Send, Plus, Trash2, CheckCircle2, Play, Upload, FlaskConical } from 'lucide-react';
import { parseJsonSafe } from '../../utils/safeFetch';

interface AdminAiSmtpTabsProps {
  mode: 'ai_providers' | 'ai_knowledge' | 'messages' | 'smtp';
  token: string;
  providers: any[];
  knowledgeDocs: any[];
  kbChunksCount?: number;
  messages: any[];
  smtpData: { settings: any; logs: any[] } | null;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminAiSmtpTabs({
  mode,
  token,
  providers,
  knowledgeDocs,
  kbChunksCount = 0,
  messages,
  smtpData,
  onReload,
  notify,
}: AdminAiSmtpTabsProps) {
  const [provName, setProvName] = useState('');
  const [provUrl, setProvUrl] = useState('https://api.groq.com/openai/v1');
  const [provModel, setProvModel] = useState('openai/gpt-oss-120b');
  const [provKey, setProvKey] = useState('');
  const [testingProvId, setTestingProvId] = useState<number | null>(null);

  // Knowledge Base
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbScope, setKbScope] = useState<'public' | 'private'>('private');
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [uploadingKb, setUploadingKb] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [suiteResults, setSuiteResults] = useState<any[] | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);

  // Messages
  const [selectedConvId, setSelectedConvId] = useState<number>(messages[0]?.id || 0);
  const [replyText, setReplyText] = useState('');
  const [sendViaEmail, setSendViaEmail] = useState(true);

  useEffect(() => {
    if (messages.length > 0 && !messages.some((m) => m.id === selectedConvId)) {
      setSelectedConvId(messages[0].id);
    }
  }, [messages, selectedConvId]);

  // SMTP
  const [smtpForm, setSmtpForm] = useState<any>(smtpData?.settings || {});
  const [smtpPass, setSmtpPass] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');

  useEffect(() => {
    if (smtpData?.settings) setSmtpForm(smtpData.settings);
  }, [smtpData]);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (mode === 'ai_providers') {
    const handleAddProvider = async (e: FormEvent) => {
      e.preventDefault();
      const res = await fetch('/api/admin/ai/providers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: provName,
          provider_type: 'openai_compatible',
          base_url: provUrl,
          model_name: provModel,
          api_key: provKey,
        }),
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) return notify(data.error || 'Failed to add provider.');
      setProvName('');
      setProvKey('');
      await onReload();
      notify('AI Provider added (API key encrypted at rest).');
    };

    const handleActivate = async (id: number) => {
      await fetch(`/api/admin/ai/providers/${id}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await onReload();
      notify('Active AI provider switched at runtime.');
    };

    const handleTest = async (id: number) => {
      setTestingProvId(id);
      try {
        const res = await fetch(`/api/admin/ai/providers/${id}/test`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseJsonSafe<any>(res);
        await onReload();
        notify(data.ok ? `Success: ${data.message}` : `Error: ${data.message}`);
      } catch (err: any) {
        notify(`Error: ${err?.message || 'Test request failed.'}`);
      } finally {
        setTestingProvId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">{p.name}</h3>
                  <p className="font-mono text-xs text-slate-400">{p.model_name}</p>
                </div>
                <span className={`font-mono text-xs ${p.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {p.is_active ? 'Active' : p.is_fallback ? 'Fallback' : 'Standby'}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400">
                Key: {p.masked_api_key || 'Not set'} · Status: {p.last_status}
              </p>
              {p.last_error ? <p className="text-xs text-red-400">{p.last_error}</p> : null}
              <div className="flex items-center gap-2 pt-2">
                {!p.is_active ? (
                  <button
                    type="button"
                    onClick={() => handleActivate(p.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    Activate
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleTest(p.id)}
                  disabled={testingProvId === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-slate-200 hover:border-zinc-500"
                >
                  <Play className="h-3 w-3" />
                  <span>{testingProvId === p.id ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddProvider} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <h3 className="font-display text-base font-semibold text-white">
            Add OpenAI-Compatible / Groq / Hugging Face Provider
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              placeholder="Provider Name (e.g. Groq Llama 3.3 70B)"
              value={provName}
              onChange={(e) => setProvName(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="url"
              required
              placeholder="API Base URL (HTTPS external host)"
              value={provUrl}
              onChange={(e) => setProvUrl(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="text"
              required
              placeholder="Model Name"
              value={provModel}
              onChange={(e) => setProvModel(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="password"
              required
              placeholder="API Key (stored AES-256-GCM encrypted)"
              value={provKey}
              onChange={(e) => setProvKey(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Save Provider</span>
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'ai_knowledge') {
    const handleSync = async () => {
      try {
        const res = await fetch('/api/admin/ai/knowledge/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseJsonSafe<any>(res);
        if (!res.ok) throw new Error(data.error || 'Sync failed.');
        await onReload();
        notify(`Knowledge base synced (${data.indexedCount} docs / ${data.chunkCount || 0} chunks).`);
      } catch (err: any) {
        notify(err?.message || 'Knowledge sync failed.');
      }
    };

    const handleAddDoc = async (e: FormEvent) => {
      e.preventDefault();
      if (kbFile) {
        setUploadingKb(true);
        try {
          const fd = new FormData();
          fd.append('file', kbFile);
          fd.append('title', kbTitle || kbFile.name);
          fd.append('content', kbContent);
          fd.append('scope', kbScope);
          const res = await fetch('/api/admin/ai/knowledge/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const data = await parseJsonSafe<any>(res);
          if (!res.ok) return notify(data.error || 'File upload failed.');
          setKbTitle('');
          setKbContent('');
          setKbFile(null);
          await onReload();
          return notify(`Document extracted (${data.extractedChars} chars) & indexed to ${kbScope} scope.`);
        } catch (err: any) {
          return notify(err?.message || 'File upload failed.');
        } finally {
          setUploadingKb(false);
        }
      }

      const res = await fetch('/api/admin/ai/knowledge', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: kbTitle, content: kbContent, scope: kbScope }),
      });
      if (res.ok) {
        setKbTitle('');
        setKbContent('');
        await onReload();
        notify(`Document added to ${kbScope} knowledge scope.`);
      }
    };

    const handleTestQuery = async (e: FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/admin/ai/knowledge/test-query', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ query: testQuery, includePrivate: false }),
        });
        setTestResult(await parseJsonSafe<any>(res));
      } catch (err: any) {
        setTestResult({ chunks: [], aiError: err?.message || 'Test query failed.' });
      }
    };

    const handleRunQuickSuite = async () => {
      setRunningSuite(true);
      const tests = [
        { label: 'Domain A: RAG Projects', query: 'What RAG systems has Abdullah Naveed built?' },
        { label: 'Domain A: Privacy Check', query: 'What is Abdullah Naveed GPA or salary expectation?' },
        { label: 'Domain B: Technical General', query: 'Compare FastAPI vs Flask concisely.' },
      ];
      const out: any[] = [];
      for (const t of tests) {
        try {
          const res = await fetch('/api/admin/ai/knowledge/test-query', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ query: t.query, includePrivate: false }),
          });
          const d = await parseJsonSafe<any>(res);
          out.push({
            ...t,
            chunksCount: d.chunks?.length || 0,
            answerPreview: d.aiResult?.answer?.slice(0, 220) || d.aiError || 'No response',
          });
        } catch (err: any) {
          out.push({
            ...t,
            chunksCount: 0,
            answerPreview: err?.message || 'Request failed.',
          });
        }
      }
      setSuiteResults(out);
      setRunningSuite(false);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Chunked Vector Knowledge Index ({knowledgeDocs.length} documents · {kbChunksCount} chunks)
            </h3>
            <p className="text-xs text-slate-400">
              Private documents never enter the public Abdullah AI prompt. Supports PDF, DOCX, TXT &amp; MD ingestion.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Rebuild Chunks &amp; Sync</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleAddDoc} className="space-y-3 rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
            <h4 className="font-display text-sm font-semibold text-white">Add or Upload Knowledge Document</h4>
            <input
              type="text"
              required={!kbFile}
              placeholder="Document Title (auto-fills from filename if uploading)"
              value={kbTitle}
              onChange={(e) => setKbTitle(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={kbScope}
                onChange={(e) => setKbScope(e.target.value as 'public' | 'private')}
                className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
              >
                <option value="private">Private (Admin Only — Never Public)</option>
                <option value="public">Public (Available to Abdullah AI)</option>
              </select>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-[#07080B] px-3 text-xs text-slate-200 hover:border-zinc-500">
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{kbFile ? kbFile.name : 'Upload PDF / DOCX / TXT / MD'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.json"
                  onChange={(e) => setKbFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>
            <textarea
              rows={3}
              required={!kbFile}
              placeholder={kbFile ? 'Optional summary notes to prepend to extracted file text...' : 'Verified factual content...'}
              value={kbContent}
              onChange={(e) => setKbContent(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
            <button
              type="submit"
              disabled={uploadingKb}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {uploadingKb ? 'Extracting & Indexing…' : 'Save & Index'}
            </button>
          </form>

          <form onSubmit={handleTestQuery} className="space-y-3 rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold text-white">Test Retrieval &amp; Grounded Answer</h4>
              <button
                type="button"
                onClick={handleRunQuickSuite}
                disabled={runningSuite}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-zinc-500"
              >
                <FlaskConical className="h-3 w-3 text-red-400" />
                <span>{runningSuite ? 'Running Suite…' : 'Run Dual-Domain Test'}</span>
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Ask test question..."
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
              />
              <button
                type="submit"
                className="rounded-lg border border-zinc-700 px-4 text-xs font-medium text-white hover:border-zinc-500"
              >
                Run Test
              </button>
            </div>
            {testResult ? (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-xs">
                <p className="font-semibold text-slate-300">
                  Top Chunks: {testResult.chunks?.map((c: any) => `${c.title} (${c.score})`).join(' · ')}
                </p>
                {testResult.aiResult?.answer ? (
                  <p className="whitespace-pre-wrap text-slate-200">{testResult.aiResult.answer}</p>
                ) : (
                  <p className="text-amber-300">{testResult.aiError}</p>
                )}
              </div>
            ) : null}
            {suiteResults ? (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-xs">
                {suiteResults.map((r, i) => (
                  <div key={i} className="border-b border-zinc-800/70 pb-2 last:border-0 last:pb-0">
                    <p className="font-mono text-red-400">
                      {r.label} ({r.chunksCount} chunks matched)
                    </p>
                    <p className="mt-0.5 text-slate-300">{r.answerPreview}…</p>
                  </div>
                ))}
              </div>
            ) : null}
          </form>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800 bg-[#0D0F14]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-slate-400">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {knowledgeDocs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 text-white">{d.title}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{d.source_type}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">{d.scope}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/ai/knowledge/${d.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        await onReload();
                      }}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mode === 'messages') {
    const activeConv = messages.find((m) => m.id === selectedConvId) || messages[0];

    const handleReply = async (e: FormEvent) => {
      e.preventDefault();
      if (!activeConv || !replyText.trim()) return;
      const res = await fetch(`/api/admin/messages/${activeConv.id}/reply`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ body: replyText, sendEmail: sendViaEmail }),
      });
      const data = await parseJsonSafe<any>(res);
      setReplyText('');
      await onReload();
      notify(data.emailResult?.message || 'Reply saved.');
    };

    const handleStatusChange = async (id: number, status: string) => {
      await fetch(`/api/admin/messages/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      await onReload();
      notify(`Marked thread as ${status}.`);
    };

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-5">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 text-sm text-slate-400">
              No recruiter conversations yet.
            </div>
          ) : (
            messages.map((c) => {
              const isFromAi = c.company === 'Via Abdullah AI' || String(c.subject || '').startsWith('[Abdullah AI]');
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConvId(c.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    activeConv?.id === c.id
                      ? 'border-red-600/60 bg-[#121620]'
                      : 'border-zinc-800 bg-[#0D0F14] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-200">{c.recruiter_name}</span>
                    <div className="flex items-center gap-2">
                      {isFromAi ? (
                        <span className="rounded bg-blue-950/60 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
                          Abdullah AI
                        </span>
                      ) : null}
                      <span
                        className={`font-mono ${
                          c.status === 'New' ? 'font-bold text-red-400' : 'text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{c.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    Contact: {c.recruiter_email}
                  </p>
                </button>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 lg:col-span-7">
          {activeConv ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">{activeConv.subject}</h3>
                  <p className="text-xs text-slate-400">
                    {activeConv.recruiter_name} · Contact: <span className="text-slate-200">{activeConv.recruiter_email}</span> · {activeConv.company || 'Independent'}
                  </p>
                </div>
                <select
                  value={activeConv.status}
                  onChange={(e) => handleStatusChange(activeConv.id, e.target.value)}
                  className="h-9 rounded-lg border border-zinc-700 bg-[#07080B] px-3 text-xs text-white"
                >
                  {['New', 'Read', 'In Progress', 'Replied', 'Closed', 'Spam'].map((st) => (
                    <option key={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto">
                {activeConv.messages.map((m: any) => (
                  <div key={m.id} className="rounded-lg border border-zinc-800 bg-[#07080B] p-3.5 text-sm">
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span className="font-medium text-white">{m.sender_name}</span>
                      <span className="font-mono">{m.created_at}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-200">{m.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="space-y-3 border-t border-zinc-800 pt-4">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write reply to recruiter..."
                  className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={sendViaEmail}
                      onChange={(e) => setSendViaEmail(e.target.checked)}
                    />
                    <span>Send via configured SMTP email</span>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Reply</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Select a conversation to view and reply.</p>
          )}
        </div>
      </div>
    );
  }

  // SMTP Settings
  const handleSaveSmtp = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/smtp', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ ...smtpForm, password: smtpPass }),
    });
    if (res.ok) {
      setSmtpPass('');
      await onReload();
      notify('SMTP settings saved (password encrypted at rest).');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveSmtp} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">SMTP Email Configuration</h3>
            <p className="text-xs text-slate-400">Credentials are encrypted at rest and never returned after saving.</p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Save SMTP</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="SMTP Host (e.g. smtp.gmail.com)"
            value={smtpForm.host || ''}
            onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="number"
            placeholder="Port (587)"
            value={smtpForm.port || 587}
            onChange={(e) => setSmtpForm({ ...smtpForm, port: Number(e.target.value) })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <select
            value={smtpForm.encryption_mode || 'starttls'}
            onChange={(e) => setSmtpForm({ ...smtpForm, encryption_mode: e.target.value })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          >
            <option value="starttls">STARTTLS (587)</option>
            <option value="ssl">SSL/TLS (465)</option>
          </select>
          <input
            type="text"
            placeholder="SMTP Username"
            value={smtpForm.username || ''}
            onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="password"
            placeholder={smtpData?.settings?.has_password ? '•••••• (leave blank to keep)' : 'SMTP Password'}
            value={smtpPass}
            onChange={(e) => setSmtpPass(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="email"
            placeholder="Sender Email"
            value={smtpForm.from_email || ''}
            onChange={(e) => setSmtpForm({ ...smtpForm, from_email: e.target.value })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="email"
            placeholder="Notification Email"
            value={smtpForm.notification_email || ''}
            onChange={(e) => setSmtpForm({ ...smtpForm, notification_email: e.target.value })}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <label className="flex items-center gap-2 text-xs text-slate-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(smtpForm.is_enabled)}
              onChange={(e) => setSmtpForm({ ...smtpForm, is_enabled: e.target.checked })}
            />
            <span>Enable outgoing SMTP notifications &amp; CV attachments</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/admin/smtp/test-connection', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              const d = await parseJsonSafe<any>(res);
              notify(d.message || d.error || 'SMTP test completed.');
            }}
            className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs text-slate-200 hover:border-zinc-500"
          >
            Test Connection
          </button>
          <input
            type="email"
            placeholder="Test recipient email"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
          />
          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/admin/smtp/test-email', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ to: testEmailTo }),
              });
              const d = await parseJsonSafe<any>(res);
              await onReload();
              notify(d.message || d.error || 'SMTP test email finished.');
            }}
            className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs text-slate-200 hover:border-zinc-500"
          >
            Send Test Email
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
        <h4 className="font-display text-sm font-semibold text-white">Delivery Logs</h4>
        <div className="mt-3 max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-slate-400">
                <th className="pb-2">Recipient</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {(smtpData?.logs || []).map((log: any) => (
                <tr key={log.id}>
                  <td className="py-2 text-slate-200">{log.recipient}</td>
                  <td className="py-2 text-slate-400">{log.subject}</td>
                  <td className="py-2 font-mono text-slate-300">{log.status}</td>
                  <td className="py-2 text-right font-mono text-slate-500">{log.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
