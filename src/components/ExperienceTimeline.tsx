import { useRef, useState } from 'react';
import { Building2, MapPin, Calendar, ArrowUpRight } from 'lucide-react';
import { CompanyExperience, ProjectItem } from '../types/portfolio';
import {
  WaterCardReveal,
  WaterFlowText,
  useWaterScrollWave,
} from './MotionReveal';

interface ExperienceTimelineProps {
  companies: CompanyExperience[];
  projects: ProjectItem[];
  onSelectProject: (project: ProjectItem) => void;
}

export function ExperienceTimeline({
  companies,
  projects,
  onSelectProject,
}: ExperienceTimelineProps) {
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabsWave = useWaterScrollWave(tabsRef);
  const [activeCompanyId, setActiveCompanyId] = useState<number>(companies[0]?.id || 0);
  const selectedCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  if (!companies.length) return null;

  const relatedProjects = selectedCompany
    ? projects.filter((p) => p.company_id === selectedCompany.id)
    : [];

  return (
    <section id="experience" className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
      <div className="mb-8 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
          {companies.length} Seasons
        </p>
        <WaterFlowText
          as="h2"
          text="My Journey"
          accentVariant="blue-purple"
          className="mt-1 font-display text-4xl font-bold tracking-wide uppercase sm:text-5xl"
        />
      </div>

      {/* Video 1 Horizontal Season Tabs */}
      <div ref={tabsRef} className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {companies.map((company, idx) => {
          const isSelected = selectedCompany?.id === company.id;
          return (
            <WaterCardReveal
              key={company.id}
              index={idx}
              sharedProgress={tabsWave}
              className="flex"
            >
              <button
                type="button"
                onClick={() => setActiveCompanyId(company.id)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-[#e50914] bg-[#141720]'
                    : 'border-zinc-800/90 bg-[#0D0F14] hover:border-zinc-700'
                }`}
              >
                <p className="font-mono text-[11px] font-semibold text-[#e50914] uppercase">
                  Season 0{idx + 1} · {company.arrangement}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold tracking-wide text-white uppercase">
                  {company.name}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{company.overall_dates}</p>
              </button>
            </WaterCardReveal>
          );
        })}
      </div>

      {/* Active Season Detail */}
      {selectedCompany ? (
        <WaterCardReveal index={1}>
          <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#e50914]">
                <Building2 className="h-3.5 w-3.5" />
                <span>{selectedCompany.arrangement}</span>
              </div>
              <h3 className="mt-1 font-display text-3xl font-bold tracking-wide text-white uppercase">
                {selectedCompany.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedCompany.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {selectedCompany.overall_dates}
                </span>
              </div>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {selectedCompany.roles.length}{' '}
              {selectedCompany.roles.length === 1 ? 'Episode / Role' : 'Episodes / Roles'}
            </span>
          </div>

          {selectedCompany.description ? (
            <p className="mt-5 text-sm leading-relaxed text-slate-300">
              {selectedCompany.description}
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {selectedCompany.roles.map((role, idx) => (
              <div
                key={role.id}
                className="flex flex-col justify-between rounded-lg border border-zinc-800/90 bg-[#08090D] p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#e50914] uppercase">
                      Episode 0{idx + 1} · {role.employment_type}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {role.start_date} – {role.end_date}
                    </span>
                  </div>

                  <h4 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                    {role.title}
                  </h4>

                  {role.description ? (
                    <p className="text-xs leading-relaxed text-slate-300">{role.description}</p>
                  ) : null}

                  {role.responsibilities.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
                      {role.responsibilities.map((item, rIdx) => (
                        <li key={rIdx}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-800/70 pt-3">
                  {role.skills.length > 0 ? (
                    <p className="font-mono text-[11px] text-slate-400">
                      {role.skills.join(' · ')}
                    </p>
                  ) : null}
                  {role.evidence_note ? (
                    <p className="text-[11px] text-slate-500">{role.evidence_note}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {relatedProjects.length > 0 ? (
            <div className="mt-8 border-t border-zinc-800/80 pt-6">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Associated Portfolio Systems
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relatedProjects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onSelectProject(proj)}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#12151E] px-4 py-3 text-left transition-colors hover:border-zinc-600"
                  >
                    <span className="truncate pr-2 text-xs font-semibold text-white">
                      {proj.title}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#e50914]" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          </div>
        </WaterCardReveal>
      ) : null}
    </section>
  );
}
