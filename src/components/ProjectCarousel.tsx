import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight, Eye, Github, Play, ExternalLink } from 'lucide-react';
import { ProfileMode, ProjectItem } from '../types/portfolio';

interface ProjectCarouselProps {
  projects: ProjectItem[];
  profileMode: ProfileMode;
  onSelectProject: (project: ProjectItem) => void;
}

interface CollectionRowProps {
  title: string;
  subtitle: string;
  items: ProjectItem[];
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

function CollectionRow({ title, subtitle, items, onSelectProject, onQuickView }: CollectionRowProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  if (items.length === 0) return null;

  const scrollByAmount = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: 'smooth' });
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
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-[#0D0F14] text-slate-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label={`Scroll ${title} right`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-[#0D0F14] text-slate-300 transition-colors hover:border-zinc-600 hover:text-white"
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
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pt-1"
      >
        {items.map((project) => {
          const hasImgError = imgErrors[project.id];
          const statusLabel = project.status || 'Completed';

          return (
            <article
              key={project.id}
              className="group relative flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-zinc-800/90 bg-[#0D0F14] transition-all duration-200 hover:-translate-y-1 hover:border-zinc-500 sm:w-[350px]"
            >
              <button
                type="button"
                onClick={() => onSelectProject(project)}
                className="relative aspect-video w-full overflow-hidden bg-zinc-950 text-left"
              >
                {project.cover_image && !hasImgError ? (
                  <img
                    src={project.cover_image}
                    alt={`${project.title} preview`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, [project.id]: true }))}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-[#10131d] to-zinc-950 p-6">
                    <span className="font-display text-xl font-bold text-slate-300 uppercase">
                      {project.title}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-black/35 to-transparent" />
              </button>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-medium">
                    <span className="text-[#e50914] uppercase">{project.category}</span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span className={getStatusColorClass(statusLabel)}>{statusLabel}</span>
                    {project.live_url && project.live_demo_verified ? (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-slate-200">Live</span>
                      </>
                    ) : null}
                  </div>
                  <h4 className="mt-1.5 text-base font-semibold leading-snug text-white">
                    <button
                      type="button"
                      onClick={() => onSelectProject(project)}
                      className="text-left transition-colors hover:text-[#e50914]"
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-[#e50914] whitespace-nowrap shrink-0"
                    >
                      <span>Open Case Study</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onQuickView(project)}
                        aria-label={`Quick view ${project.title}`}
                        className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-slate-300 hover:border-zinc-600 hover:text-white whitespace-nowrap shrink-0"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Quick</span>
                      </button>
                      {project.live_url ? (
                        <a
                          href={project.live_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${project.title} live demo`}
                          title="Open Verified Live Demo"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-emerald-400 hover:border-emerald-500/60 hover:text-emerald-300"
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
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-slate-300 hover:border-zinc-600 hover:text-white"
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
        })}
      </div>
    </div>
  );
}

export function ProjectCarousel({ projects, profileMode, onSelectProject }: ProjectCarouselProps) {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [quickViewProject, setQuickViewProject] = useState<ProjectItem | null>(null);

  const categories = ['All', ...Array.from(new Set(projects.map((p) => p.category)))];
  const filtered =
    activeFilter === 'All' ? projects : projects.filter((p) => p.category === activeFilter);

  const spotlights = (() => {
    if (profileMode === 'developer') {
      const devFirst = projects.filter((p) => p.live_url || p.category === 'Full-Stack Development');
      if (devFirst.length >= 2) return devFirst.slice(0, 2);
    }
    return projects.filter((p) => p.is_featured === 1).slice(0, 2);
  })();

  const featured = filtered.filter((p) => p.is_featured === 1);
  const genAi = filtered.filter((p) => p.category === 'Generative AI & RAG');
  const cv = filtered.filter((p) => p.category === 'Computer Vision');
  const mlMlops = filtered.filter(
    (p) => p.category === 'AI & Machine Learning' || p.category === 'Automation & MLOps'
  );
  const fullStack = filtered.filter((p) => p.category === 'Full-Stack Development');

  const orderedCollections = (() => {
    const base = [
      {
        key: 'featured',
        title: 'Featured Systems',
        subtitle: 'Flagship multi-agent, RAG, live deployed full-stack, and computer vision architectures',
        items: featured,
      },
      {
        key: 'genai',
        title: 'Generative AI & RAG',
        subtitle: 'Retrieval-Augmented Generation, semantic search, embeddings, and multi-agent pipelines',
        items: genAi,
      },
      {
        key: 'cv',
        title: 'Computer Vision',
        subtitle: 'YOLOv8 edge inference, RTSP stream relays, OpenCV, and IDM-VTON pipelines',
        items: cv,
      },
      {
        key: 'ml',
        title: 'AI, Machine Learning & MLOps',
        subtitle: '60+ standalone ML/DL implementations, DVC, MLflow, and end-to-end training pipelines',
        items: mlMlops,
      },
      {
        key: 'fullstack',
        title: 'Full-Stack Engineering',
        subtitle: 'FastAPI, Next.js, TypeScript, Express, PostgreSQL, and Docker Compose applications',
        items: fullStack,
      },
    ];

    if (profileMode === 'developer') return [base[4], base[0], base[1], base[3], base[2]];
    if (profileMode === 'ai_ml') return [base[1], base[2], base[3], base[0], base[4]];
    return base;
  })();

  return (
    <section id="projects" className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
      {/* Two-Up Originals Spotlight */}
      {spotlights.length >= 2 && activeFilter === 'All' ? (
        <div className="mb-16">
          <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
            {profileMode === 'developer' ? 'Production Systems' : 'Originals'}
          </p>
          <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
            {profileMode === 'developer' ? 'Deployed & Full-Stack Spotlights' : 'Flagship Builds'}
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {spotlights.map((spot, idx) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => onSelectProject(spot)}
                className={`group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-xl border p-6 text-left transition-transform duration-200 hover:-translate-y-1 sm:p-8 ${
                  idx === 0
                    ? 'border-red-900/50 bg-gradient-to-br from-[#2d070c] via-[#12080c] to-[#08090C]'
                    : 'border-amber-900/40 bg-gradient-to-br from-[#241807] via-[#110d08] to-[#08090C]'
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
                  <p className="font-mono text-[11px] font-semibold tracking-[0.18em] text-[#e50914] uppercase">
                    Original · {spot.category} · {spot.status || 'Completed'}
                    {spot.live_url ? ' · Live Demo' : ''}
                  </p>
                  <h3 className="font-display text-3xl font-bold tracking-wide text-white uppercase sm:text-4xl">
                    {spot.title.split('—')[0].trim()}
                  </h3>
                  <p className="max-w-lg text-sm leading-relaxed text-slate-300">
                    {spot.tagline}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5 fill-white" />
                      <span>Inspect Architecture</span>
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
        <div>
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#e50914] uppercase">
            Complete Catalog
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-wide text-white uppercase sm:text-4xl">
            Systems &amp; Repositories
          </h2>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setQuickViewProject(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0F14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full bg-zinc-950">
              {quickViewProject.cover_image ? (
                <img
                  src={quickViewProject.cover_image}
                  alt={quickViewProject.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-black/45 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <p className="font-mono text-xs font-medium text-[#e50914] uppercase">
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
                {quickViewProject.live_url ? (
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
                  className="rounded-md bg-[#e50914] px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
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
