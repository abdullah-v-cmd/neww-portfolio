import { useEffect, useRef, useState } from 'react';
import {
  X,
  Github,
  ExternalLink,
  Layers,
  Database,
  Cpu,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Info,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
} from 'lucide-react';
import { ProjectItem } from '../types/portfolio';

interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeShotIndex, setActiveShotIndex] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setIsMuted(true);
    setVideoFailed(false);
    setProgress(0);
    setDuration(0);
    setActiveShotIndex(0);
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onVisibility = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [project, onClose]);

  if (!project) return null;

  const layers = [
    { label: 'Frontend', value: project.frontend_stack || 'N/A', icon: Layers },
    { label: 'Backend', value: project.backend_stack || 'N/A', icon: Workflow },
    { label: 'AI / Models', value: project.ai_models_stack || 'N/A', icon: Cpu },
    { label: 'Database / Storage', value: project.database_stack || 'N/A', icon: Database },
  ].filter((l) => l.value !== 'N/A');

  const statusLabel = project.status || 'Completed';
  const hasVideo = Boolean(project.preview_video_url) && !videoFailed;
  const mediaImages = [project.cover_image, ...(project.screenshots || [])].filter(Boolean);
  const activeImage = mediaImages[activeShotIndex] || project.cover_image;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => undefined);
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/88 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-blue-500/25 bg-[#0B0D12] shadow-[0_28px_90px_-15px_rgba(37,99,235,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cinematic Video Player / Verified Visual Banner */}
        <div
          ref={playerContainerRef}
          className="relative aspect-[16/8] w-full overflow-hidden bg-zinc-950"
        >
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                src={project.preview_video_url}
                poster={project.cover_image || undefined}
                muted={isMuted}
                playsInline
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime || 0)}
                onError={() => setVideoFailed(true)}
                onClick={togglePlay}
                className="h-full w-full cursor-pointer object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-transparent to-black/25" />

              {/* Accessible Video Player Controls (Never Autoplays Audio) */}
              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-5 pb-3 pt-8">
                {duration > 0 ? (
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={progress}
                    aria-label="Video timeline"
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      if (videoRef.current) videoRef.current.currentTime = t;
                      setProgress(t);
                    }}
                    className="h-1 w-full cursor-pointer accent-blue-500"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-500"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/90 text-slate-200 hover:border-zinc-500"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-[11px] text-slate-300">
                      {formatTime(progress)} / {formatTime(duration)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    aria-label="Toggle fullscreen video"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/90 text-slate-200 hover:border-zinc-500"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : activeImage ? (
            <>
              <img
                src={activeImage}
                alt={project.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-black/55 to-black/20" />
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close project details"
            className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/90 text-slate-200 transition-colors hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <X className="h-4 w-4" />
          </button>

          {!hasVideo ? (
            <div className="absolute bottom-6 left-6 right-6 z-10">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-300">
                <span className="font-medium text-blue-400">{project.category}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    statusLabel === 'Completed'
                      ? 'text-emerald-400'
                      : statusLabel === 'In Progress'
                      ? 'text-amber-400'
                      : 'text-sky-400'
                  }
                >
                  {statusLabel}
                </span>
                {project.github_repo_name ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-300">{project.github_repo_name}</span>
                  </>
                ) : null}
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
                {project.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{project.tagline}</p>
            </div>
          ) : null}
        </div>

        {/* Title Header + Video Description Strip when video player occupies top frame */}
        {hasVideo ? (
          <div className="border-b border-zinc-800/80 bg-[#080A10] px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-300">
              <span className="font-medium text-blue-400">{project.category}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">{statusLabel}</span>
              {project.video_description ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-purple-300">{project.video_description}</span>
                </>
              ) : null}
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
              {project.title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-300">{project.tagline}</p>
          </div>
        ) : mediaImages.length > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-800/80 bg-[#080A10] px-6 py-3 sm:px-8">
            {mediaImages.map((src, idx) => (
              <button
                key={`${src}-${idx}`}
                type="button"
                onClick={() => setActiveShotIndex(idx)}
                className={`h-12 w-20 shrink-0 overflow-hidden rounded border transition-all ${
                  activeShotIndex === idx
                    ? 'border-blue-500 ring-1 ring-blue-500/60'
                    : 'border-zinc-800 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-8 p-6 sm:p-8">
          {/* Brief Description & Direct Repository / Live Links */}
          <div className="space-y-4 border-b border-zinc-800/80 pb-6">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                Brief Description
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                {project.overview || project.tagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {project.github_url ? (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0"
                >
                  <Github className="h-4 w-4" />
                  <span>
                    GitHub Repository{project.github_repo_name ? ` (${project.github_repo_name})` : ''}
                  </span>
                </a>
              ) : null}
              {project.live_url ? (
                <a
                  href={project.live_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-600/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30 whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>
                    {project.live_demo_verified ? 'Open Live Public Link (Verified)' : 'Open Live Public Link'}
                  </span>
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-400">
                  Live public link not hosted (source &amp; setup on GitHub)
                </span>
              )}
              {project.companion_group ? (
                <span className="font-mono text-xs text-slate-400">
                  Series: {project.companion_group}
                </span>
              ) : null}
            </div>
          </div>

          {/* Honest Limitations / Scope Notice */}
          {project.limitations ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-xs leading-relaxed text-amber-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-100">Project Status &amp; Scope Disclosure</p>
                <p className="mt-1">{project.limitations}</p>
              </div>
            </div>
          ) : null}

          {/* Problem & Solution */}
          {project.problem_statement || project.solution_summary ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {project.problem_statement ? (
                <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-5">
                  <h4 className="text-xs font-semibold tracking-wider text-red-400 uppercase">
                    Problem Statement
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {project.problem_statement}
                  </p>
                </div>
              ) : null}
              {project.solution_summary ? (
                <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-5">
                  <h4 className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                    Proposed Solution
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {project.solution_summary}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Interactive Architecture Flow */}
          {layers.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-semibold text-white">
                System Architecture
              </h3>
              {project.architecture_notes ? (
                <p className="text-sm text-slate-400">{project.architecture_notes}</p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {layers.map((layer) => {
                  const Icon = layer.icon;
                  return (
                    <div
                      key={layer.label}
                      className="rounded-xl border border-zinc-800 bg-[#10131A] p-4"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Icon className="h-3.5 w-3.5 text-blue-400" />
                        <span>{layer.label}</span>
                      </div>
                      <p className="mt-2 font-mono text-xs leading-relaxed text-slate-200">
                        {layer.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              {project.rag_pipeline_notes ? (
                <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-5">
                  <h4 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                    Retrieval &amp; RAG Pipeline
                  </h4>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-blue-300">
                    {project.rag_pipeline_notes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Features & Challenges */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {project.features.length > 0 ? (
              <div>
                <h3 className="font-display text-lg font-semibold text-white">Key Capabilities</h3>
                <ul className="mt-3 space-y-2.5">
                  {project.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {project.challenges.length > 0 ? (
              <div>
                <h3 className="font-display text-lg font-semibold text-white">Engineering Challenges</h3>
                <ul className="mt-3 space-y-2.5">
                  {project.challenges.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Verified Observations */}
          {project.verified_results.length > 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-5">
              <h3 className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                Verified Repository Observations
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                {project.verified_results.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Technologies */}
          {project.technologies.length > 0 ? (
            <div className="border-t border-zinc-800/80 pt-5">
              <p className="text-xs font-medium text-slate-400">Technologies</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-slate-200">
                {project.technologies.join(' · ')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
