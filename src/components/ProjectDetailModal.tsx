import { useEffect } from 'react';
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
} from 'lucide-react';
import { ProjectItem } from '../types/portfolio';

interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, onClose]);

  if (!project) return null;

  const layers = [
    { label: 'Frontend', value: project.frontend_stack || 'N/A', icon: Layers },
    { label: 'Backend', value: project.backend_stack || 'N/A', icon: Workflow },
    { label: 'AI / Models', value: project.ai_models_stack || 'N/A', icon: Cpu },
    { label: 'Database / Storage', value: project.database_stack || 'N/A', icon: Database },
  ].filter((l) => l.value !== 'N/A');

  const statusLabel = project.status || 'Completed';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B0D12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Banner */}
        <div className="relative aspect-[16/7] w-full bg-zinc-950">
          {project.cover_image ? (
            <img
              src={project.cover_image}
              alt={project.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-black/55 to-black/20" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project details"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/90 text-slate-200 transition-colors hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-300">
              <span className="font-medium text-red-400">{project.category}</span>
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
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          {/* Brief Description & Direct Repository / Live Links */}
          <div className="space-y-4 border-b border-zinc-800/80 pb-6">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-[#e50914] uppercase">
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
          <div className="space-y-6">

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
          </div>

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
                        <Icon className="h-3.5 w-3.5 text-red-400" />
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
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
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
