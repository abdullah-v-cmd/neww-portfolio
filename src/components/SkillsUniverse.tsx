import { useState } from 'react';
import { ArrowUpRight, Layers, Briefcase } from 'lucide-react';
import { CompanyExperience, ProjectItem, SkillCategory } from '../types/portfolio';

interface SkillsUniverseProps {
  categories: SkillCategory[];
  projects: ProjectItem[];
  experience: CompanyExperience[];
  onSelectProject: (project: ProjectItem) => void;
}

export function SkillsUniverse({
  categories,
  projects,
  experience,
  onSelectProject,
}: SkillsUniverseProps) {
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>(
    categories[0]?.slug || 'ai-ml'
  );
  const [selectedSkill, setSelectedSkill] = useState<string>(
    categories[0]?.skills[0]?.name || 'Python'
  );

  const activeCategory =
    categories.find((c) => c.slug === activeCategorySlug) || categories[0];

  const normalizedQuery = selectedSkill.toLowerCase();
  const matchingProjects = projects.filter(
    (p) =>
      p.technologies.some(
        (t) => t.toLowerCase() === normalizedQuery || t.toLowerCase().includes(normalizedQuery)
      ) ||
      p.overview.toLowerCase().includes(normalizedQuery) ||
      p.ai_models_stack.toLowerCase().includes(normalizedQuery) ||
      p.backend_stack.toLowerCase().includes(normalizedQuery)
  );

  const matchingRoles = experience.flatMap((comp) =>
    comp.roles
      .filter(
        (r) =>
          r.skills.some(
            (s) => s.toLowerCase() === normalizedQuery || s.toLowerCase().includes(normalizedQuery)
          ) ||
          r.responsibilities.some((resp) => resp.toLowerCase().includes(normalizedQuery)) ||
          r.description.toLowerCase().includes(normalizedQuery)
      )
      .map((r) => ({ company: comp.name, role: r }))
  );

  const handleSelectCategory = (cat: SkillCategory) => {
    setActiveCategorySlug(cat.slug);
    if (cat.skills.length > 0) {
      setSelectedSkill(cat.skills[0].name);
    }
  };

  return (
    <section id="skills" className="border-t border-zinc-900 bg-[#08090C]">
      <div className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
              03 · Everything Connects
            </p>
            <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
              My Skill Universe
            </h2>
          </div>
          <p className="max-w-md text-xs text-slate-400">
            Select a category on the left and click any node to trace verified production projects and roles.
          </p>
        </div>

        {/* Video 1 Left Rail + Right Stage + Video 2 Connection Graph */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Category Rail */}
          <div className="space-y-2 lg:col-span-4">
            {categories.map((cat) => {
              const active = activeCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-left transition-all ${
                    active
                      ? 'border-zinc-700 bg-[#151822] text-white'
                      : 'border-zinc-900 bg-[#0C0E13] text-slate-400 hover:border-zinc-800 hover:text-slate-200'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{cat.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {cat.skills.length} capabilities
                    </p>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      active ? 'bg-[#e50914]' : 'bg-zinc-800'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Interactive Constellation & Evidence Panel */}
          <div className="space-y-6 lg:col-span-8">
            {activeCategory ? (
              <div className="rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e50914] uppercase">
                      Active Domain
                    </p>
                    <h3 className="mt-0.5 font-display text-2xl font-bold tracking-wide text-white uppercase">
                      {activeCategory.name}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    Selected: <strong className="text-white">{selectedSkill}</strong>
                  </span>
                </div>

                {/* Clickable Skill Tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {activeCategory.skills.map((skill) => {
                    const isSelected = selectedSkill === skill.name;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => setSelectedSkill(skill.name)}
                        className={`flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all ${
                          isSelected
                            ? 'border-[#e50914] bg-gradient-to-br from-[#2a090d] to-[#120b0e] text-white'
                            : 'border-zinc-800 bg-[#090B0F] text-slate-300 hover:border-zinc-600 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-semibold">{skill.name}</span>
                        <span className="mt-2 font-mono text-[10px] text-slate-500">
                          {skill.proficiency_label || 'Verified stack'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Connected Projects & Experience Strip (Video 1 bottom strip + Video 2 SVG connection visual) */}
            <div className="rounded-xl border border-zinc-800/90 bg-gradient-to-r from-[#18090c] via-[#0F1118] to-[#0D0F14] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white uppercase">
                  <Layers className="h-4 w-4 text-[#e50914]" />
                  <span>Connected Work Using {selectedSkill}</span>
                </div>
                <span className="font-mono text-xs text-slate-400">
                  {matchingProjects.length} projects · {matchingRoles.length} roles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  {matchingProjects.length > 0 ? (
                    matchingProjects.slice(0, 4).map((proj) => (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => onSelectProject(proj)}
                        className="group flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-[#0A0C10]/90 px-4 py-2.5 text-left transition-colors hover:border-zinc-600"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="truncate text-xs font-semibold text-white group-hover:text-[#e50914]">
                            {proj.title}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">{proj.category}</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-white" />
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      Included in Abdullah&apos;s verified engineering skillset; browse Projects above for full repositories.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {matchingRoles.length > 0 ? (
                    matchingRoles.map((item) => (
                      <div
                        key={item.role.id}
                        className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-[#0A0C10]/90 px-4 py-2.5"
                      >
                        <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <div>
                          <p className="text-xs font-semibold text-white">{item.role.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.company} · {item.role.start_date} – {item.role.end_date}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-zinc-800/70 bg-[#0A0C10]/60 px-4 py-3 text-xs text-slate-400">
                      Applied across self-directed engineering builds and public GitHub repositories.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
