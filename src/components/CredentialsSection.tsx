import { useEffect, useRef, useState } from 'react';
import {
  Award,
  ExternalLink,
  Download,
  Maximize2,
  GraduationCap,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  Loader2,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { CertificateItem, EducationEntry } from '../types/portfolio';
import {
  WaterCardReveal,
  WaterFlowText,
  useWaterScrollWave,
} from './MotionReveal';

// Polyfill Promise.withResolvers for browsers older than Chrome 119 / Safari 17.4
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface CredentialsSectionProps {
  education: EducationEntry[];
  certificates: CertificateItem[];
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024);
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, limit));
  return header.includes('%PDF-');
}

function PdfCanvasViewer({ fileUrl, title }: { fileUrl: string; title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [renderingPages, setRenderingPages] = useState(false);
  const [fallbackMode, setFallbackMode] = useState<'none' | 'native'>('none');

  // Effect 1: Fetch PDF bytes once per fileUrl (sends same-origin cookies cleanly, skips worker Range/CORS failures)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    setPdfDoc(null);
    setNumPages(0);
    setLoadingDoc(true);
    setFallbackMode('none');
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    async function loadDocument() {
      try {
        const isSameOrigin =
          fileUrl.startsWith('/') ||
          (typeof window !== 'undefined' && fileUrl.startsWith(window.location.origin));

        const response = await fetch(fileUrl, {
          credentials: isSameOrigin ? 'same-origin' : 'omit',
          mode: isSameOrigin ? 'same-origin' : 'cors',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const bytes = new Uint8Array(buffer);
        if (!hasPdfSignature(bytes)) {
          throw new Error('Response is not a valid PDF document.');
        }

        loadingTask = pdfjsLib.getDocument({
          data: bytes,
          disableRange: true,
          disableStream: true,
        });

        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy().catch(() => undefined);
          return;
        }

        loadedDoc = doc;
        setNumPages(doc.numPages);
        setPdfDoc(doc);
      } catch (err: any) {
        if (!cancelled && err?.name !== 'AbortError') {
          setFallbackMode('native');
        }
      } finally {
        if (!cancelled) {
          setLoadingDoc(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
      controller.abort();
      try {
        loadedDoc?.cleanup?.();
      } catch {
        // Ignore cleanup errors
      }
      try {
        loadingTask?.destroy?.();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [fileUrl]);

  // Effect 2: Render pages cleanly into off-DOM fragment without re-fetching PDF on zoom
  useEffect(() => {
    if (!pdfDoc || fallbackMode !== 'none') return;

    let cancelled = false;
    const renderTasks: Array<{ cancel?: () => void }> = [];

    async function renderPages() {
      setRenderingPages(true);
      try {
        let host = containerRef.current;
        if (host && host.clientWidth < 50) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          host = containerRef.current;
        }
        if (cancelled || !host) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const containerWidth = Math.max((host.clientWidth || 720) - 32, 320);
        const frag = document.createDocumentFragment();

        for (let pageNum = 1; pageNum <= pdfDoc!.numPages; pageNum++) {
          const page = await pdfDoc!.getPage(pageNum);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const fitScale = Math.min((containerWidth / baseViewport.width) * (scale / 1.25), 2.4);
          const viewport = page.getViewport({ scale: Math.max(fitScale, 0.7) });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = 'mx-auto block rounded-lg border border-zinc-800 bg-white shadow-2xl';
          canvas.setAttribute('aria-label', `${title} — Page ${pageNum}`);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const task = page.render({ canvasContext: ctx, viewport, canvas } as any);
            renderTasks.push(task);
            await task.promise;
          }

          if (cancelled) return;
          frag.appendChild(canvas);
        }

        if (!cancelled && containerRef.current) {
          containerRef.current.replaceChildren(frag);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setFallbackMode('native');
        }
      } finally {
        if (!cancelled) {
          setRenderingPages(false);
        }
      }
    }

    renderPages();

    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        try {
          task.cancel?.();
        } catch {
          // Ignore cancel errors
        }
      }
    };
  }, [pdfDoc, scale, title, fallbackMode]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-[#0A0C10] px-4 py-2 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-mono">
          <FileText className="h-3.5 w-3.5 text-[#e50914]" />
          <span>{numPages > 0 ? `${numPages} Page${numPages > 1 ? 's' : ''}` : 'PDF Document'}</span>
          {renderingPages && !loadingDoc ? (
            <Loader2 className="h-3 w-3 animate-spin text-sky-400" aria-label="Updating zoom" />
          ) : null}
        </div>
        {fallbackMode === 'none' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.2).toFixed(2))))}
              aria-label="Zoom out"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700 hover:border-zinc-500"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center font-mono text-[11px]">{Math.round((scale / 1.25) * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.25, Number((s + 0.2).toFixed(2))))}
              aria-label="Zoom in"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700 hover:border-zinc-500"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-sky-300 hover:border-sky-400"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Open PDF Directly</span>
          </a>
        )}
      </div>

      <div className="relative flex-1 overflow-y-auto bg-zinc-950 p-4">
        {loadingDoc ? (
          <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>Loading certificate document...</span>
          </div>
        ) : null}

        {fallbackMode === 'native' ? (
          <div className="flex h-full min-h-[480px] flex-col gap-3">
            <iframe
              src={fileUrl}
              title={title}
              className="h-full min-h-[480px] w-full flex-1 rounded-lg border border-zinc-800 bg-zinc-900"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-[#0D0F14] px-4 py-2.5 text-xs text-slate-300">
              <span>Showing native browser PDF viewer.</span>
              <div className="flex items-center gap-3">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <a
                  href={fileUrl}
                  download
                  className="inline-flex items-center gap-1 font-semibold text-white hover:text-red-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={containerRef} className={fallbackMode === 'native' ? 'hidden' : 'space-y-4'} />
      </div>
    </div>
  );
}

export function CredentialsSection({ education, certificates }: CredentialsSectionProps) {
  const eduGridRef = useRef<HTMLDivElement | null>(null);
  const certGridRef = useRef<HTMLDivElement | null>(null);
  const eduWave = useWaterScrollWave(eduGridRef);
  const certWave = useWaterScrollWave(certGridRef);
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
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
              Academic Foundation
            </p>
            <WaterFlowText
              as="h2"
              text="Education"
              accentVariant="cyan-blue"
              className="mt-1 font-display text-4xl font-bold tracking-wide uppercase sm:text-5xl"
            />
          </div>

          <div ref={eduGridRef} className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {education.map((edu, idx) => (
              <WaterCardReveal
                key={edu.id}
                index={idx}
                sharedProgress={eduWave}
                className="flex"
              >
                <div className="relative w-full overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6">
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
              </WaterCardReveal>
            ))}
          </div>
        </div>

        {/* Certificates */}
        <div>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
                Top Moments · Certified
              </p>
              <WaterFlowText
                as="h2"
                text="Verified Credentials"
                accentVariant="blue-purple"
                className="mt-1 font-display text-4xl font-bold tracking-wide uppercase sm:text-5xl"
              />
            </div>
            <p className="max-w-md text-xs text-slate-400">
              Authentic Coursera and DeepLearning.AI certificates with full-screen document preview and official verification links.
            </p>
          </div>

          <div ref={certGridRef} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert, idx) => (
              <WaterCardReveal
                key={cert.id}
                index={idx % 3}
                sharedProgress={certWave}
                className="flex"
              >
                <article
                  className="group relative flex w-full flex-col justify-between overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0D0F14] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-500"
                >
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
              </WaterCardReveal>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Certificate Lightbox with Direct PDF Canvas Rendering */}
      {previewCert ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate Preview: ${previewCert.title}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/92 p-3 sm:p-6"
          onClick={() => setPreviewCert(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0F14]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3.5">
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
                {previewCert.file_url ? (
                  <a
                    href={previewCert.file_url}
                    download
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-white whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                ) : null}
                {previewCert.verify_url ? (
                  <a
                    href={previewCert.verify_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-sky-300 hover:border-sky-400 whitespace-nowrap shrink-0"
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
            <div className="min-h-0 flex-1 overflow-hidden bg-zinc-950">
              {!previewCert.file_url ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-slate-400">
                  No document file attached to this certificate yet.
                </div>
              ) : previewCert.file_type === 'image' ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  <img
                    src={previewCert.file_url}
                    alt={previewCert.title}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <PdfCanvasViewer fileUrl={previewCert.file_url} title={previewCert.title} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
