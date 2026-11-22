import { useEffect, useState } from 'react';
import { X, Play, Sparkles } from 'lucide-react';
import { ProjectItem } from '../types/portfolio';
import { MonogramLogo } from './MonogramLogo';

interface ProjectOpeningTransitionProps {
  project: ProjectItem | null;
  onComplete: (project: ProjectItem) => void;
  onCancel: () => void;
}

export function ProjectOpeningTransition({
  project,
  onComplete,
  onCancel,
}: ProjectOpeningTransitionProps) {
  const [phase, setPhase] = useState<'enter' | 'expand' | 'exit'>('enter');

  useEffect(() => {
    if (!project) return;
    setPhase('enter');

    const expandFrame = requestAnimationFrame(() => {
      setPhase('expand');
    });

    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, 640);

    const completeTimer = window.setTimeout(() => {
      onComplete(project);
    }, 840);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(expandFrame);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [project, onComplete, onCancel]);

  if (!project) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${project.title}`}
      onClick={() => onComplete(project)}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#04050a]/95 px-4 backdrop-blur-xl transition-opacity duration-300 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ perspective: '1400px' }}
    >
      {/* Blue & Purple Ambient Cinema Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.22),transparent_48%),radial-gradient(circle_at_72%_65%,rgba(139,92,246,0.2),transparent_50%)]"
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        aria-label="Cancel opening transition"
        className="absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/90 text-slate-300 hover:border-white hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      {/* DVD / Streaming Perspective Stage */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onComplete(project);
        }}
        className="relative w-full max-w-3xl cursor-pointer overflow-hidden rounded-2xl border border-blue-500/35 bg-[#0A0D16] shadow-[0_32px_90px_-15px_rgba(59,130,246,0.45)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform:
            phase === 'enter'
              ? 'rotateY(-14deg) rotateX(6deg) scale(0.84)'
              : phase === 'expand'
              ? 'rotateY(0deg) rotateX(0deg) scale(1)'
              : 'scale(1.04)',
          opacity: phase === 'enter' ? 0 : 1,
        }}
      >
        {/* Diagonal Light Sweep */}
        <div
          aria-hidden="true"
          className="animate-light-sweep pointer-events-none absolute inset-y-0 left-0 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        {/* Media Presentation */}
        <div className="relative aspect-[16/8] w-full overflow-hidden bg-zinc-950">
          {project.preview_video_url ? (
            <video
              src={project.preview_video_url}
              poster={project.cover_image || undefined}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : project.cover_image ? (
            <img
              src={project.cover_image}
              alt={project.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 scale-[1.03]"
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0D16] via-[#0A0D16]/45 to-black/25" />

          <div className="absolute left-5 top-5 flex items-center gap-2.5">
            <MonogramLogo size="sm" />
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.2em] text-blue-300 uppercase">
              <Sparkles className="h-3 w-3 text-purple-400" />
              <span>Opening Feature</span>
            </span>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="space-y-3 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="font-semibold text-blue-400 uppercase">{project.category}</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-purple-300">{project.status || 'Completed'}</span>
            {project.live_url && project.live_demo_verified ? (
              <>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-emerald-400">Live Verified</span>
              </>
            ) : null}
          </div>

          <h2 className="font-display text-3xl font-bold tracking-wide text-white uppercase sm:text-4xl">
            {project.title}
          </h2>
          <p className="line-clamp-2 text-sm text-slate-300">{project.tagline}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-3">
            <p className="truncate font-mono text-xs text-slate-400">
              {project.technologies.slice(0, 5).join(' · ')}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400">
              <Play className="h-3.5 w-3.5 fill-blue-400" />
              <span>Launching Case Study…</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
