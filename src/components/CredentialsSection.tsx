import { useEffect, useState } from 'react';
import { Award, ExternalLink, Download, Maximize2, GraduationCap, X } from 'lucide-react';
import { CertificateItem, EducationEntry } from '../types/portfolio';

interface CredentialsSectionProps {
  education: EducationEntry[];
  certificates: CertificateItem[];
}

export function CredentialsSection({ education, certificates }: CredentialsSectionProps) {
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);

  useEffect(() => {
    if (!previewCert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewCert(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewCert]);

  return (
    <section id="credentials" className="border-t border-zinc-900 bg-[#060608]">
      <div className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
        {/* Education */}
        <div className="mb-16">
          <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
            Academic Foundation
          </p>
          <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
            Education
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {education.map((edu) => (
              <div
                key={edu.id}
                className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#e50914] via-amber-400/70 to-transparent" />
                <div className="flex items-center gap-2 text-xs font-medium text-sky-400">
                  <GraduationCap className="h-4 w-4" />
                  <span>{edu.institution}</span>
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  {edu.degree}{edu.field ? ` — ${edu.field}` : ''}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {edu.student_name}
                  {(edu.start_date || edu.end_date)
                    ? ` · ${edu.start_date}${edu.end_date ? ` – ${edu.end_date}` : ''}`
                    : ''}
                </p>
                {edu.details ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{edu.details}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Certificates — Video 1 "Top Moments / Verified Credentials" style */}
        <div>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
                Top Moments · Certified
              </p>
              <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
                Verified Credentials
              </h2>
            </div>
            <p className="max-w-md text-xs text-slate-400">
              Authentic Coursera and DeepLearning.AI certificates with full-screen document preview and official verification links.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert, idx) => (
              <article
                key={cert.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0D0F14] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-500"
              >
                {/* Top highlight cinema bar (gold for featured, crimson accent otherwise) */}
                <div
                  className={`h-[3px] w-full ${
                    cert.is_featured === 1
                      ? 'bg-gradient-to-r from-amber-400 via-[#e50914] to-amber-500'
                      : 'bg-gradient-to-r from-[#e50914] to-zinc-700'
                  }`}
                />

                <div>
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="relative flex h-44 w-full flex-col justify-between border-b border-zinc-800/80 bg-gradient-to-br from-[#131724] via-[#0D0F14] to-[#08090C] p-5 text-left"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
                        <Award className="h-3.5 w-3.5 text-[#e50914]" />
                        {cert.issuer}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        0{idx + 1} · {cert.issue_date}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-2xl font-bold leading-tight tracking-wide text-white uppercase transition-colors group-hover:text-red-400">
                        {cert.title}
                      </h3>
                      {cert.credential_id ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          Credential ID: {cert.credential_id}
                        </p>
                      ) : null}
                    </div>
                  </button>

                  <div className="space-y-3 p-5">
                    {cert.description ? (
                      <p className="text-xs leading-relaxed text-slate-400">{cert.description}</p>
                    ) : null}
                    {cert.skills.length > 0 ? (
                      <p className="font-mono text-[11px] text-slate-400">
                        {cert.skills.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white transition-colors hover:text-[#e50914] whitespace-nowrap shrink-0"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Preview Document</span>
                  </button>

                  <div className="flex items-center gap-4">
                    {cert.file_url ? (
                      <a
                        href={cert.file_url}
                        download
                        className="inline-flex items-center gap-1 text-xs text-slate-300 transition-colors hover:text-white whitespace-nowrap shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    ) : null}
                    {cert.verify_url ? (
                      <a
                        href={cert.verify_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 transition-colors hover:text-sky-300 whitespace-nowrap shrink-0"
                      >
                        <span>Verify</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Certificate Lightbox */}
      {previewCert ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate Preview: ${previewCert.title}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/92 p-4 sm:p-6"
          onClick={() => setPreviewCert(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0F14]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate font-display text-xl font-bold tracking-wide text-white uppercase">
                  {previewCert.title}
                </h3>
                <p className="truncate text-xs text-slate-400">
                  {previewCert.issuer} · {previewCert.issue_date}
                  {previewCert.credential_id ? ` · ID ${previewCert.credential_id}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewCert.verify_url ? (
                  <a
                    href={previewCert.verify_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-white whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Official Verify</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewCert(null)}
                  aria-label="Close certificate preview"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-slate-300 hover:border-white hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-zinc-950">
              {previewCert.file_type === 'image' ? (
                <img
                  src={previewCert.file_url}
                  alt={previewCert.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <iframe
                  title={previewCert.title}
                  src={previewCert.file_url}
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
