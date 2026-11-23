import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Eye,
  Github,
  Play,
  Square,
  ExternalLink,
  Loader2,
  Film,
} from 'lucide-react';
import { ProfileMode, ProjectItem } from '../types/portfolio';
import { WaterFlowText } from './MotionReveal';

interface ProjectCarouselProps {
  projects: ProjectItem[];
  profileMode: ProfileMode;
  videoAutoplayPreview?: boolean;
  onSelectProject: (project: ProjectItem) => void;
}

interface CollectionRowProps {
  title: string;
  subtitle: string;
  accent?: 'red' | 'blue' | 'purple';
  items: ProjectItem[];
  videoAutoplayPreview: boolean;
  onSelectProject: (project: ProjectItem) => void;
  onQuickView: (project: ProjectItem) => void;
}

function getStatusColorClass(status?: string): string {
  switch (status) {
    case 'Completed':
      return 'text-emerald-400';
    case 'In Progress':
      return 'text-amber-400';
    case 'Experimental':
      return 'text-sky-400';
    default:
      return 'text-slate-400';
  }
}

function ProjectDiscoveryCard({
  project,
  videoAutoplayPreview,
  onSelectProject,
  onQuickView,
}: {
  project: ProjectItem;
  videoAutoplayPreview: boolean;
  onSelectProject: (project: ProjectItem) => void;
  onQuickView: (project: ProjectItem) => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [videoWanted, setVideoWanted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const hasVideo = Boolean(project.preview_video_url) && !videoFailed;
  const statusLabel = project.status || 'Completed';

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Pause & unmount lazy preview video cleanly when card leaves viewport or tab is hidden
  useEffect(() => {
    if (!videoWanted) return;

    const stopVideo = () => {
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.currentTime = 0;
      }
      setVideoWanted(false);
      setVideoReady(false);
    };

    const onVisibility = () => {
      if (document.hidden) stopVideo();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const el = cardRef.current;
    let observer: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.every((entry) => !entry.isIntersecting)) {
            stopVideo();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(el);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [videoWanted]);

  const startPreview = () => {
    if (!hasVideo || !videoAutoplayPreview || prefersReducedMotion) return;
    setVideoWanted(true);
  };

  const stopPreview = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setVideoWanted(false);
    setVideoReady(false);
  };

  const canHoverDevice = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => {
        if (canHoverDevice()) startPreview();
      }}
      onMouseLeave={() => {
        if (canHoverDevice()) stopPreview();
      }}
      className="group relative flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0D0F14] transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:border-blue-500/60 hover:shadow-[0_18px_45px_-12px_rgba(59,130,246,0.28)] sm:w-[356px]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
        <button
          type="button"
          onClick={() => onSelectProject(project)}
          aria-label={`Open ${project.title}`}
          className="relative block h-full w-full text-left focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {project.cover_image && !imgError ? (
            <img
              src={project.cover_image}
              alt={`${project.title} preview`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
                videoWanted && videoReady ? 'opacity-0' : 'opacity-100'
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-[#10131d] to-zinc-950 p-6">
              <span className="font-display text-xl font-bold text-slate-300 uppercase">
                {project.title}
              </span>
            </div>
          )}

          {/* Lazy-mounted muted preview video (zero upfront download) */}
          {videoWanted && hasVideo ? (
            <video
              ref={videoRef}
              src={project.preview_video_url}
              poster={project.cover_image || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onCanPlay={() => setVideoReady(true)}
              onError={() => {
                setVideoFailed(true);
                setVideoWanted(false);
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                videoReady ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-black/30 to-transparent" />
        </button>

        {/* Subtle buffering indicator while lazy video loads */}
        {videoWanted && !videoReady ? (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-blue-300 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading preview…</span>
          </div>
        ) : null}

        {/* Touch-friendly explicit preview control when a real preview video exists */}
        {hasVideo ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (videoWanted) stopPreview();
              else setVideoWanted(true);
            }}
            aria-label={videoWanted ? `Stop video preview for ${project.title}` : `Play video preview for ${project.title}`}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/75 px-2.5 py-1 font-mono text-[10px] font-medium text-white backdrop-blur-md transition-colors hover:border-blue-400 hover:text-blue-300"
          >
            {videoWanted ? (
              <>
                <Square className="h-2.5 w-2.5 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Film className="h-3 w-3 text-blue-400" />
                <span>Preview</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-medium">
            <span className="text-[#e50914] uppercase">{project.category}</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className={getStatusColorClass(statusLabel)}>{statusLabel}</span>
            {project.live_url && project.live_demo_verified ? (
              <>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-blue-300">Live Demo</span>
              </>
            ) : null}
          </div>

          <h4 className="mt-1.5 text-base font-semibold leading-snug text-white">
            <button
              type="button"
              onClick={() => onSelectProject(project)}
              className="text-left transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:text-blue-400"
            >
              {project.title}
            </button>
          </h4>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {project.tagline}
          </p>
        </div>

        <div className="mt-4 space-y-3 border-t border-zinc-800/70 pt-3">
          <p className="truncate font-mono text-[11px] text-slate-400">
            {project.technologies.slice(0, 5).join(' · ')}
          </p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelectProject(project)}
              className="inline-flex items-center gap-1 text-xs font-medium text-white transition-colors hover:text-blue-400 whitespace-nowrap shrink-0"
            >
              <span>Open Case Study</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onQuickView(project)}
                aria-label={`Quick view ${project.title}`}
                className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:border-zinc-600 hover:text-white whitespace-nowrap shrink-0"
              >
                <Eye className="h-3 w-3" />
                <span>Quick</span>
              </button>
              {project.live_url && project.live_demo_verified ? (
                <a
                  href={project.live_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${project.title} live demo`}
                  title="Open Verified Live Demo"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-emerald-400 transition-colors hover:border-emerald-500/60 hover:text-emerald-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {project.github_url ? (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${project.title} on GitHub`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-slate-300 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  <Github className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CollectionRow({
  title,
  subtitle,
  items,
  videoAutoplayPreview,
  onSelectProject,
  onQuickView,
}: CollectionRowProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) return null;

  const scrollByAmount = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.82, 740), behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label={`Scroll ${title} left`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-[#0D0F14] text-slate-300 transition-colors hover:border-blue-500/60 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label={`Scroll ${title} right`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-[#0D0F14] text-slate-300 transition-colors hover:border-blue-500/60 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        role="region"
        aria-label={`${title} project carousel`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') scrollByAmount(1);
          if (e.key === 'ArrowLeft') scrollByAmount(-1);
        }}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pt-1 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {items.map((project) => (
          <ProjectDiscoveryCard
            key={project.id}
            project={project}
            videoAutoplayPreview={videoAutoplayPreview}
            onSelectProject={onSelectProject}
            onQuickView={onQuickView}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectCarousel({
  projects,
  profileMode,
  videoAutoplayPreview = true,
  onSelectProject,
}: ProjectCarouselProps) {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [quickViewProject, setQuickViewProject] = useState<ProjectItem | null>(null);

  const categories = ['All', ...Array.from(new Set(projects.map((p) => p.category)))];
  const filtered =
    activeFilter === 'All' ? projects : projects.filter((p) => p.category === activeFilter);

  const isCompletedOrProd = (p: ProjectItem) =>
    !p.status || p.status === 'Completed';

  const spotlights = (() => {
    const completed = projects.filter(isCompletedOrProd);
    if (profileMode === 'developer') {
      const devFirst = completed.filter((p) => p.live_url || p.category === 'Full-Stack Development' || p.category === 'Enterprise Applications');
      if (devFirst.length >= 2) return devFirst.slice(0, 2);
    }
    return completed.filter((p) => p.is_featured === 1).slice(0, 2);
  })();

  const featured = filtered.filter((p) => p.is_featured === 1 && isCompletedOrProd(p));
  const genAi = filtered.filter((p) => p.category === 'Generative AI & RAG' && isCompletedOrProd(p));
  const cv = filtered.filter((p) => p.category === 'Computer Vision' && isCompletedOrProd(p));
  const mlMlops = filtered.filter(
    (p) => (p.category === 'AI & Machine Learning' || p.category === 'Automation & MLOps') && isCompletedOrProd(p)
  );
  const fullStackEnterprise = filtered.filter(
    (p) => (p.category === 'Full-Stack Development' || p.category === 'Enterprise Applications') && isCompletedOrProd(p)
  );
  const experimentalResearch = filtered.filter(
    (p) => p.status === 'Experimental' || p.status === 'In Progress' || p.status === 'Incomplete' || p.category === 'Research & Experimental'
  );

  const orderedCollections = (() => {
    const base = [
      {
        key: 'featured',
        title: 'Featured Projects',
        subtitle: 'Flagship multi-agent, RAG, live deployed full-stack, and computer vision architectures',
        items: featured,
      },
      {
        key: 'genai',
        title: 'Generative AI & RAG Systems',
        subtitle: 'Retrieval-Augmented Generation, semantic search, embeddings, and multi-agent pipelines',
        items: genAi,
      },
      {
        key: 'ml',
        title: 'Artificial Intelligence & Machine Learning',
        subtitle: '60+ standalone ML/DL implementations, DVC, MLflow, and end-to-end training pipelines',
        items: mlMlops,
      },
      {
        key: 'fullstack',
        title: 'Full-Stack & Enterprise Applications',
        subtitle: 'FastAPI, Next.js, TypeScript, Express, PostgreSQL, and Docker Compose applications',
        items: fullStackEnterprise,
      },
      {
        key: 'cv',
        title: 'Computer Vision',
        subtitle: 'YOLOv8 edge inference, RTSP stream relays, OpenCV, and visual inspection pipelines',
        items: cv,
      },
      {
        key: 'experimental',
        title: 'Research & Experimental Projects',
        subtitle: 'Active prototypes and exploratory research systems — clearly labeled with scope & maturity notes',
        items: experimentalResearch,
      },
    ];

    if (profileMode === 'developer') return [base[3], base[0], base[1], base[2], base[4], base[5]];
    if (profileMode === 'ai_ml') return [base[1], base[2], base[4], base[0], base[3], base[5]];
    return base;
  })();

  return (
    <section id="projects" className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
      {/* Two-Up Originals Spotlight */}
      {spotlights.length >= 2 && activeFilter === 'All' ? (
        <div className="mb-16">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-blue-400 uppercase">
              {profileMode === 'developer' ? 'Production Systems' : 'Featured Premieres · Flagship Builds'}
            </p>
            <WaterFlowText
              as="h2"
              text={profileMode === 'developer' ? 'Deployed & Full-Stack Spotlights' : 'Where Ideas Become Reality'}
              accentVariant="cinema"
              className="mt-1 font-display text-4xl font-bold tracking-wide uppercase sm:text-5xl"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {spotlights.map((spot, idx) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => onSelectProject(spot)}
                className={`group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-xl border p-6 text-left transition-transform duration-300 hover:-translate-y-1 sm:p-8 ${
                  idx === 0
                    ? 'border-blue-500/35 bg-gradient-to-br from-[#0e1930] via-[#0b0e18] to-[#08090C] hover:border-blue-400/70'
                    : 'border-purple-500/35 bg-gradient-to-br from-[#1b102d] via-[#0e0b16] to-[#08090C] hover:border-purple-400/70'
                }`}
              >
                {spot.cover_image ? (
                  <img
                    src={spot.cover_image}
                    alt={spot.title}
                    referrerPolicy="no-referrer"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/70 to-transparent" />

                <div className="relative z-10 space-y-2.5">
                  <p className="font-mono text-[11px] font-semibold tracking-[0.18em] text-blue-400 uppercase">
                    Verified · {spot.category} · {spot.status || 'Completed'}
                    {spot.live_url && spot.live_demo_verified ? ' · Live Demo' : ''}
                  </p>
                  <h3 className="font-display text-3xl font-bold tracking-wide text-white uppercase sm:text-4xl">
                    {spot.title.split('—')[0].trim()}
                  </h3>
                  <p className="max-w-lg text-sm leading-relaxed text-slate-300">
                    {spot.tagline}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-white">
                    <span className="inline-flex items-center gap-1.5 text-blue-300 group-hover:text-white">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Open Project</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      {spot.technologies.slice(0, 4).join(' · ')}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filter Header */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#e50914] uppercase">
            Complete Catalog
          </p>
          <WaterFlowText
            as="h2"
            text="Systems & Repositories"
            accentVariant="cyan-blue"
            className="mt-1 font-display text-3xl font-bold tracking-wide uppercase sm:text-4xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0D0F14] p-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveFilter(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeFilter === cat ? 'bg-[#e50914] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-14">
        {orderedCollections.map((col) => (
          <CollectionRow
            key={col.key}
            title={col.title}
            subtitle={col.subtitle}
            items={col.items}
            videoAutoplayPreview={videoAutoplayPreview}
            onSelectProject={onSelectProject}
            onQuickView={setQuickViewProject}
          />
        ))}
      </div>

      {quickViewProject ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Quick view: ${quickViewProject.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setQuickViewProject(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0F14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full bg-zinc-950">
              {quickViewProject.preview_video_url ? (
                <video
                  src={quickViewProject.preview_video_url}
                  poster={quickViewProject.cover_image || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : quickViewProject.cover_image ? (
                <img
                  src={quickViewProject.cover_image}
                  alt={quickViewProject.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-black/45 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <p className="font-mono text-xs font-medium text-blue-400 uppercase">
                  {quickViewProject.category} · {quickViewProject.status || 'Completed'}
                </p>
                <h3 className="mt-1 font-display text-3xl font-bold text-white uppercase">
                  {quickViewProject.title}
                </h3>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm leading-relaxed text-slate-300">{quickViewProject.overview}</p>
              {quickViewProject.limitations ? (
                <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                  Scope note: {quickViewProject.limitations}
                </p>
              ) : null}
              <p className="font-mono text-xs text-slate-400">
                {quickViewProject.technologies.join(' · ')}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                {quickViewProject.github_url ? (
                  <a
                    href={quickViewProject.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:border-zinc-500"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span>GitHub Repo</span>
                  </a>
                ) : null}
                {quickViewProject.live_url && quickViewProject.live_demo_verified ? (
                  <a
                    href={quickViewProject.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Live Public Link</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setQuickViewProject(null)}
                  className="rounded-md border border-zinc-800 px-4 py-2 text-xs font-medium text-slate-300 hover:border-zinc-600 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = quickViewProject;
                    setQuickViewProject(null);
                    onSelectProject(target);
                  }}
                  className="rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white hover:from-blue-500 hover:to-purple-500"
                >
                  Open Full Case Study
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
