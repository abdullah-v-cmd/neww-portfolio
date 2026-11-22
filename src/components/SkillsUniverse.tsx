import { useEffect, useState } from 'react';
import { ArrowUpRight, Layers, Briefcase, Search, X, Cpu, CheckCircle2 } from 'lucide-react';
import { CompanyExperience, ProjectItem, SkillCategory, SkillItem } from '../types/portfolio';

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
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(
    categories[0]?.skills[0] || null
  );
  const [modalSkill, setModalSkill] = useState<SkillItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    if (!modalSkill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalSkill(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalSkill]);

  const activeCategory =
    categories.find((c) => c.slug === activeCategorySlug) || categories[0];

  const getLinkedProjectsForSkill = (skill: SkillItem | null): ProjectItem[] => {
    if (!skill) return [];
    const linkedIds = new Set(skill.linked_project_ids || []);
    const q = skill.name.toLowerCase();
    return projects.filter(
      (p) =>
        linkedIds.has(p.id) ||
        p.technologies.some((t) => t.toLowerCase() === q || t.toLowerCase().includes(q)) ||
        p.overview.toLowerCase().includes(q) ||
        p.ai_models_stack.toLowerCase().includes(q) ||
        p.backend_stack.toLowerCase().includes(q)
    );
  };

  const getLinkedRolesForSkill = (
    skill: SkillItem | null
  ): Array<{ company: string; role: CompanyExperience['roles'][number] }> => {
    if (!skill) return [];
    const linkedIds = new Set(skill.linked_role_ids || []);
    const q = skill.name.toLowerCase();
    return experience.flatMap((comp) =>
      comp.roles
        .filter(
          (r) =>
            linkedIds.has(r.id) ||
            r.skills.some((s) => s.toLowerCase() === q || s.toLowerCase().includes(q)) ||
            r.responsibilities.some((resp) => resp.toLowerCase().includes(q)) ||
            r.description.toLowerCase().includes(q)
        )
        .map((r) => ({ company: comp.name, role: r }))
    );
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const displayedSkills: Array<{ skill: SkillItem; categoryName: string }> = normalizedSearch || statusFilter !== 'All'
    ? categories.flatMap((cat) =>
        cat.skills
          .filter((s) => {
            const matchesText =
              !normalizedSearch ||
              s.name.toLowerCase().includes(normalizedSearch) ||
              (s.description || '').toLowerCase().includes(normalizedSearch);
            const matchesStatus =
              statusFilter === 'All' || (s.status || 'Used in Projects') === statusFilter;
            return matchesText && matchesStatus;
          })
          .map((skill) => ({ skill, categoryName: cat.name }))
      )
    : (activeCategory?.skills || []).map((skill) => ({
        skill,
        categoryName: activeCategory?.name || '',
      }));

  const currentSkill = selectedSkill || displayedSkills[0]?.skill || null;
  const matchingProjects = getLinkedProjectsForSkill(currentSkill);
  const matchingRoles = getLinkedRolesForSkill(currentSkill);

  const modalProjects = getLinkedProjectsForSkill(modalSkill);
  const modalRoles = getLinkedRolesForSkill(modalSkill);
  const modalCategory = modalSkill
    ? categories.find((c) => c.id === modalSkill.category_id)?.name || 'Engineering'
    : '';

  const handleSelectCategory = (cat: SkillCategory) => {
    setSearchQuery('');
    setStatusFilter('All');
    setActiveCategorySlug(cat.slug);
    if (cat.skills.length > 0) {
      setSelectedSkill(cat.skills[0]);
    }
  };

  return (
    <section id="skills" className="border-t border-zinc-900 bg-[#08090C]">
      <div className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
              03 · Everything Connects
            </p>
            <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
              My Skill Universe
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills (e.g. FastAPI, RAG)..."
                className="h-9 w-60 rounded-lg border border-zinc-800 bg-[#0D0F14] pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-[#e50914] focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter skills by experience status"
              className="h-9 rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 text-xs text-slate-200 focus:border-[#e50914] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Used in Projects">Used in Projects</option>
              <option value="Professional Experience">Professional Experience</option>
              <option value="Learning / Familiar">Learning / Familiar</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Category Rail */}
          <div className="space-y-2 lg:col-span-4">
            {categories.map((cat) => {
              const active = !normalizedSearch && statusFilter === 'All' && activeCategory?.id === cat.id;
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
                      {cat.skills.length} verified skills
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
            <div className="rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e50914] uppercase">
                    {normalizedSearch || statusFilter !== 'All' ? 'Filtered Results' : 'Active Domain'}
                  </p>
                  <h3 className="mt-0.5 font-display text-2xl font-bold tracking-wide text-white uppercase">
                    {normalizedSearch || statusFilter !== 'All'
                      ? `${displayedSkills.length} Matching Skills`
                      : activeCategory?.name}
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Click any skill for full breakdown &amp; linked work
                </span>
              </div>

              {displayedSkills.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  No skills match your search filter. Clear search to view all verified capabilities.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {displayedSkills.map(({ skill }) => {
                    const isSelected = currentSkill?.id === skill.id;
                    const projCount = getLinkedProjectsForSkill(skill).length;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          setSelectedSkill(skill);
                          setModalSkill(skill);
                        }}
                        className={`group flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all ${
                          isSelected
                            ? 'border-[#e50914] bg-gradient-to-br from-[#2a090d] to-[#120b0e] text-white'
                            : 'border-zinc-800 bg-[#090B0F] text-slate-300 hover:border-zinc-500 hover:text-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold">{skill.name}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-500 transition-colors group-hover:text-white" />
                        </div>
                        <span className="mt-2 font-mono text-[10px] text-slate-400">
                          {projCount > 0
                            ? `${projCount} linked ${projCount === 1 ? 'system' : 'systems'}`
                            : skill.status || skill.proficiency_label || 'Verified'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Connected Projects & Experience Summary Strip */}
            {currentSkill ? (
              <div className="rounded-xl border border-zinc-800/90 bg-gradient-to-r from-[#18090c] via-[#0F1118] to-[#0D0F14] p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white uppercase">
                    <Layers className="h-4 w-4 text-[#e50914]" />
                    <span>Connected Work Using {currentSkill.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">
                      {matchingProjects.length} projects · {matchingRoles.length} roles
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalSkill(currentSkill)}
                      className="text-xs font-semibold text-[#e50914] hover:underline"
                    >
                      Inspect Full Skill Card
                    </button>
                  </div>
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
                        Included in Abdullah&apos;s verified engineering stack; click &ldquo;Inspect Full Skill Card&rdquo; for application details.
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
                        Applied across engineering builds and verified GitHub repositories.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Interactive Skill Detail Modal */}
      {modalSkill ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Skill details: ${modalSkill.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4"
          onClick={() => setModalSkill(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B0D12] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-800 bg-[#0F1219] px-6 py-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="text-[#e50914] uppercase">{modalCategory}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {modalSkill.status || modalSkill.proficiency_label || 'Verified Skill'}
                  </span>
                </div>
                <h3 className="font-display text-3xl font-bold tracking-wide text-white uppercase">
                  {modalSkill.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSkill(null)}
                aria-label="Close skill detail modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-slate-400 hover:border-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-6">
              {modalSkill.what_it_does || modalSkill.description ? (
                <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">
                    <Cpu className="h-3.5 w-3.5 text-[#e50914]" />
                    <span>What It Does</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {modalSkill.what_it_does || modalSkill.description}
                  </p>
                </div>
              ) : null}

              {modalSkill.how_abdullah_uses ? (
                <div className="rounded-xl border border-zinc-800 bg-[#10131A] p-4">
                  <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                    How Abdullah Naveed Applies It
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    {modalSkill.how_abdullah_uses}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Linked Projects ({modalProjects.length})
                  </h4>
                  {modalProjects.length > 0 ? (
                    <div className="space-y-2">
                      {modalProjects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => {
                            setModalSkill(null);
                            onSelectProject(proj);
                          }}
                          className="group flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-[#0D0F14] px-3.5 py-2.5 text-left transition-colors hover:border-[#e50914]/60"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate text-xs font-semibold text-white group-hover:text-[#e50914]">
                              {proj.title}
                            </p>
                            <p className="truncate font-mono text-[11px] text-slate-400">
                              {proj.category} · {proj.status || 'Completed'}
                            </p>
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-white" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No linked projects assigned yet.</p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Linked Experience Roles ({modalRoles.length})
                  </h4>
                  {modalRoles.length > 0 ? (
                    <div className="space-y-2">
                      {modalRoles.map((item) => (
                        <div
                          key={item.role.id}
                          className="rounded-lg border border-zinc-800 bg-[#0D0F14] px-3.5 py-2.5"
                        >
                          <p className="text-xs font-semibold text-white">{item.role.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {item.company} · {item.role.start_date} – {item.role.end_date}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Applied across academic, self-directed, and public open-source work.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
