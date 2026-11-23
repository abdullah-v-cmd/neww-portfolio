import { Download, MessageSquare, FileCheck2 } from 'lucide-react';
import { WaterFlowText } from './MotionReveal';
import {
  CertificateItem,
  CompanyExperience,
  EducationEntry,
  ProfileSettings,
  ProjectItem,
} from '../types/portfolio';

interface FullStorySectionProps {
  profile: ProfileSettings;
  experience: CompanyExperience[];
  education: EducationEntry[];
  projects: ProjectItem[];
  certificates: CertificateItem[];
  onDownloadResume: () => void;
  onRequestCv: () => void;
  onOpenAI: () => void;
  onSelectProject: (proj: ProjectItem) => void;
}

export function FullStorySection({
  profile,
  experience,
  education,
  projects,
  certificates,
  onDownloadResume,
  onRequestCv,
  onOpenAI,
  onSelectProject,
}: FullStorySectionProps) {
  const featured = projects.filter((p) => p.is_featured === 1).slice(0, 3);

  return (
    <section id="story" className="border-t border-zinc-900 bg-[#08090C]">
      <div className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
        <div className="mb-10 space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
            The Screenplay · AI &amp; Machine Learning
          </p>
          <WaterFlowText
            as="h2"
            text="Intelligence. Innovation. Possibilities."
            accentVariant="blue-purple"
            className="mt-1 font-display text-4xl font-bold tracking-wide uppercase sm:text-5xl"
          />
          <p className="text-xs text-slate-400">
            The Full Story — Verified Engineering Dossier &amp; Applied Systems Architecture
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Dossier Sheet */}
          <div className="space-y-8 rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6 sm:p-8 lg:col-span-8">
            <div className="border-b border-zinc-800 pb-6">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-400 uppercase">
                Principal Engineer Dossier
              </p>
              <h3 className="mt-1 font-display text-3xl font-bold tracking-wide text-white uppercase">
                {profile.full_name}
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                {profile.location} · {profile.email} · github.com/abdullah-v-cmd
              </p>
            </div>

            {/* Education Block */}
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e50914] uppercase">
                Education
              </p>
              <div className="mt-3 space-y-2">
                {education.map((edu) => (
                  <div key={edu.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{edu.institution}</p>
                      <p className="text-xs text-slate-400">
                        {edu.degree}{edu.field ? ` · ${edu.field}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {edu.start_date || 'In Progress'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Experience Condensed */}
            <div className="border-t border-zinc-800/80 pt-6">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e50914] uppercase">
                Work Experience
              </p>
              <div className="mt-4 space-y-4">
                {experience.map((comp) => (
                  <div key={comp.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {comp.name} <span className="font-normal text-slate-400">· {comp.location}</span>
                      </p>
                      <span className="font-mono text-xs text-slate-400">{comp.overall_dates}</span>
                    </div>
                    <div className="space-y-1">
                      {comp.roles.map((r) => (
                        <p key={r.id} className="text-xs text-slate-300">
                          <span className="font-medium text-slate-200">{r.title}</span> ({r.start_date} – {r.end_date} · {r.employment_type})
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Builds */}
            <div className="border-t border-zinc-800/80 pt-6">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e50914] uppercase">
                Flagship Systems
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {featured.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onSelectProject(proj)}
                    className="rounded-lg border border-zinc-800 bg-[#12151E] p-3.5 text-left transition-colors hover:border-zinc-600"
                  >
                    <p className="text-xs font-semibold text-white">{proj.title.split('—')[0].trim()}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{proj.tagline}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Quick Summary Card */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6 sm:p-8 lg:col-span-4">
            <div className="space-y-5">
              <h3 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                Recruiter Access
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Verified engineering track record across applied ML/DL model training, Retrieval-Augmented Generation, YOLOv8 real-time vision, and containerized full-stack systems.
              </p>

              <div className="space-y-2.5 pt-2">
                {profile.resume_url ? (
                  <button
                    type="button"
                    onClick={onDownloadResume}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Public Resume PDF</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onRequestCv}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition-colors ${
                    profile.resume_url
                      ? 'border border-zinc-700 bg-zinc-900 text-white hover:border-[#e50914]'
                      : 'bg-white text-zinc-950 hover:bg-slate-200'
                  }`}
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-[#e50914]" />
                  <span>Request Official CV via Email</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAI}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:border-zinc-500"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#e50914]" />
                  <span>Ask Abdullah AI About Dossier</span>
                </button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-6 text-center">
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-white">
                  {projects.length}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Systems</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-white">
                  {experience.length}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Companies</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-white">
                  {certificates.length}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Certs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
