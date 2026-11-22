import { FormEvent, useEffect, useState } from 'react';
import { X, FileCheck2, Send, CheckCircle2 } from 'lucide-react';
import { parseJsonSafe } from '../utils/safeFetch';

interface CvRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CvRequestModal({ isOpen, onClose }: CvRequestModalProps) {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ requestUid: string; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/cv-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim(),
          email: email.trim(),
          jobTitle: jobTitle.trim(),
          message: message.trim(),
        }),
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit CV request.');
      }
      setSuccessData({
        requestUid: data.requestUid,
        message: data.message,
      });
      setFullName('');
      setCompany('');
      setEmail('');
      setJobTitle('');
      setMessage('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request Official CV"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B0D12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0F1219] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="h-4 w-4 text-[#e50914]" />
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide text-white uppercase">
                Request Official CV
              </h2>
              <p className="text-[11px] text-slate-400">
                Reviewed directly by Abdullah Naveed and sent via official email
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CV request modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-slate-400 hover:border-zinc-600 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {successData ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-sm text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="space-y-1.5">
                  <p className="font-semibold text-white">{successData.message}</p>
                  <p className="font-mono text-xs text-emerald-300">
                    Reference ID: {successData.requestUid}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessData(null);
                    onClose();
                  }}
                  className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Company / Organization *
                  </label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme AI Labs"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Professional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Job Title / Role
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Senior Technical Recruiter"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Optional Message / Opportunity Details
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share role, team focus, or tailored CV format preference..."
                  className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
                />
              </div>

              {errorMsg ? <p className="text-xs text-red-400">{errorMsg}</p> : null}

              <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-medium text-slate-300 hover:border-zinc-600 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#e50914] px-5 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Submitting…' : 'Submit CV Request'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
