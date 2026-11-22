import { FormEvent, useState } from 'react';
import { Mail, Github, Linkedin, Send, Paperclip, MessageSquare, Search, CheckCircle2, FileCheck2 } from 'lucide-react';
import { ProfileSettings } from '../types/portfolio';
import { parseJsonSafe } from '../utils/safeFetch';

interface ContactSectionProps {
  profile: ProfileSettings;
  onOpenAI: () => void;
  onRequestCv: () => void;
}

interface ThreadMessage {
  id: number;
  sender_type: 'recruiter' | 'admin';
  sender_name: string;
  body: string;
  attachment_name?: string;
  created_at: string;
}

export function ContactSection({ profile, onOpenAI, onRequestCv }: ContactSectionProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdThreadToken, setCreatedThreadToken] = useState('');

  // Two-way conversation tracker state
  const [lookupToken, setLookupToken] = useState('');
  const [activeThread, setActiveThread] = useState<{
    conversation: {
      thread_token: string;
      recruiter_name: string;
      company: string;
      subject: string;
      status: string;
    };
    messages: ThreadMessage[];
  } | null>(null);
  const [threadError, setThreadError] = useState('');
  const [followUpBody, setFollowUpBody] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  const loadThread = async (tokenToFetch: string) => {
    setThreadError('');
    try {
      const res = await fetch(`/api/public/conversations/${encodeURIComponent(tokenToFetch.trim())}`);
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) {
        throw new Error(data.error || 'Unable to load conversation.');
      }
      setActiveThread(data);
    } catch (err: any) {
      setThreadError(err?.message || 'Thread not found.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('company', company);
      formData.append('subject', subject);
      formData.append('message', message);
      if (file) formData.append('attachment', file);

      const res = await fetch('/api/public/contact', {
        method: 'POST',
        body: formData,
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');

      setCreatedThreadToken(data.threadToken);
      setLookupToken(data.threadToken);
      setName('');
      setEmail('');
      setCompany('');
      setSubject('');
      setMessage('');
      setFile(null);
      await loadThread(data.threadToken);
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeThread || !followUpBody.trim()) return;
    setSendingFollowUp(true);
    try {
      const res = await fetch(
        `/api/public/conversations/${encodeURIComponent(activeThread.conversation.thread_token)}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: followUpBody.trim() }),
        }
      );
      if (res.ok) {
        setFollowUpBody('');
        await loadThread(activeThread.conversation.thread_token);
      }
    } finally {
      setSendingFollowUp(false);
    }
  };

  return (
    <section id="contact" className="border-t border-zinc-900 bg-[#080A0E]">
      <div className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
        <div className="mb-10">
          <p className="text-xs font-medium tracking-[0.2em] text-red-500 uppercase">
            Recruiter &amp; Collaboration Portal
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start a Conversation
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Send a direct inquiry, attach a role specification, or track an existing two-way conversation thread.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Contact Channels + Thread Lookup */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 space-y-4">
              <h3 className="font-display text-lg font-semibold text-white">Direct Channels</h3>
              <div className="space-y-3 text-sm">
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
                >
                  <Mail className="h-4 w-4 text-red-400" />
                  <span>{profile.email}</span>
                </a>
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
                >
                  <Github className="h-4 w-4 text-slate-400" />
                  <span>github.com/abdullah-v-cmd</span>
                </a>
                {profile.linkedin_url ? (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
                  >
                    <Linkedin className="h-4 w-4 text-blue-400" />
                    <span>LinkedIn Profile</span>
                  </a>
                ) : null}
              </div>

              <div className="space-y-2.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={onRequestCv}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e50914] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-500"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Request Official CV</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAI}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:border-red-500"
                >
                  <MessageSquare className="h-4 w-4 text-red-500" />
                  <span>Ask Abdullah AI First</span>
                </button>
              </div>
            </div>

            {/* Thread Lookup */}
            <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-white">
                Check Two-Way Conversation
              </h3>
              <p className="text-xs text-slate-400">
                Enter your private thread reference token to view Abdullah&apos;s replies and respond directly.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (lookupToken.trim()) loadThread(lookupToken);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={lookupToken}
                  onChange={(e) => setLookupToken(e.target.value)}
                  placeholder="Paste private thread token..."
                  className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#07080B] px-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 text-xs font-medium text-white hover:border-zinc-500 whitespace-nowrap shrink-0"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Open</span>
                </button>
              </form>
              {threadError ? <p className="text-xs text-red-400">{threadError}</p> : null}
            </div>
          </div>

          {/* Form OR Active Two-Way Thread */}
          <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 sm:p-8 lg:col-span-7">
            {activeThread ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                  <div>
                    <p className="text-xs text-emerald-400">
                      Thread Active · Status: {activeThread.conversation.status}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-white">
                      {activeThread.conversation.subject}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      Private Token: {activeThread.conversation.thread_token}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveThread(null)}
                    className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-slate-300 hover:border-zinc-600 hover:text-white"
                  >
                    New Message
                  </button>
                </div>

                {createdThreadToken ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      Delivered! Save your private thread token above to check replies anytime, or reply to email notifications when SMTP is enabled.
                    </span>
                  </div>
                ) : null}

                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {activeThread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg p-3.5 text-sm ${
                        m.sender_type === 'admin'
                          ? 'border border-blue-800/50 bg-blue-950/25 text-slate-100'
                          : 'border border-zinc-800 bg-[#121620] text-slate-200'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-medium text-white">{m.sender_name}</span>
                        <span className="font-mono">{m.created_at}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {m.attachment_name ? (
                        <p className="mt-2 font-mono text-xs text-slate-400">
                          Attachment: {m.attachment_name}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleFollowUp} className="space-y-3 border-t border-zinc-800 pt-4">
                  <textarea
                    rows={3}
                    value={followUpBody}
                    onChange={(e) => setFollowUpBody(e.target.value)}
                    placeholder="Write a follow-up message..."
                    className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingFollowUp || !followUpBody.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{sendingFollowUp ? 'Sending...' : 'Send Follow-Up'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@company.com"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Company / Organization
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Labs"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="AI Engineer Role / Project Inquiry"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share role details, timeline, or technical questions..."
                    className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-[#07080B] px-3.5 py-2 text-xs text-slate-300 hover:border-zinc-600">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    <span>{file ? file.name : 'Attach Spec (PDF/DOCX/IMG, max 5MB)'}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </div>

                {submitError ? (
                  <p className="text-xs text-red-400">{submitError}</p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
