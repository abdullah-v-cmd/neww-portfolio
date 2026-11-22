import { useCallback, useEffect, useState } from 'react';
import Lenis from 'lenis';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Download,
  FileCheck2,
  Menu,
  MessageSquare,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { PortfolioPayload, ProfileMode, ProjectItem } from './types/portfolio';
import { HeroCanvas3D } from './components/HeroCanvas3D';
import { VideoBackgroundLayer } from './components/VideoBackgroundLayer';
import { CinematicIntro } from './components/CinematicIntro';
import { FullStorySection } from './components/FullStorySection';
import { ProjectCarousel } from './components/ProjectCarousel';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { CvRequestModal } from './components/CvRequestModal';
import { SkillsUniverse } from './components/SkillsUniverse';
import { ExperienceTimeline } from './components/ExperienceTimeline';
import { CredentialsSection } from './components/CredentialsSection';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { AbdullahAIChat } from './components/AbdullahAIChat';
import { AdminApp } from './components/AdminApp';

const CONTINUE_EPISODES = [
  { id: 'story', episode: 'Episode 01', title: 'The Full Story', subtitle: 'Principal Dossier' },
  { id: 'experience', episode: 'Episode 02', title: 'Work Experience', subtitle: '3 Companies' },
  { id: 'skills', episode: 'Episode 03', title: 'Skill Universe', subtitle: 'Interactive Graph' },
  { id: 'projects', episode: 'Episode 04', title: 'Featured Systems', subtitle: 'Originals & Rails' },
  { id: 'credentials', episode: 'Episode 05', title: 'Certificates', subtitle: 'Verified Honors' },
];

const PROFILE_EXPERIENCE_COPY: Record<
  ProfileMode,
  { eyebrow: string; summaryNote: string }
> = {
  explore: {
    eyebrow: 'A Series · Complete Engineering Catalog',
    summaryNote: 'Balanced walkthrough covering story, flagship AI & full-stack builds, skills, and verified experience.',
  },
  recruiter: {
    eyebrow: 'Recruiter View · Verified Credentials & Career History',
    summaryNote: 'Prioritizing employment timeline, Coursera credentials, and direct official CV request access.',
  },
  ai_ml: {
    eyebrow: 'AI / ML Engineer View · RAG, LLMs & Computer Vision',
    summaryNote: 'Lead-in focused on multi-agent RAG orchestration, YOLOv8 real-time inference, and MLOps pipelines.',
  },
  developer: {
    eyebrow: 'Software Developer View · FastAPI, Next.js & Docker Systems',
    summaryNote: 'Highlighting production APIs, full-stack TypeScript/PostgreSQL builds, and verified live deployments.',
  },
};

export default function App() {
  const [routePath, setRoutePath] = useState<string>(() => window.location.pathname || '/');
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    return (
      window.location.pathname.startsWith('/secure-admin') ||
      window.location.pathname.startsWith('/projects/')
    );
  });
  const [profileMode, setProfileMode] = useState<ProfileMode>('explore');
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/public/portfolio');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PortfolioPayload;
      setPortfolio(data);
      setLoadError('');

      if (data.theme?.seo_title) {
        document.title = data.theme.seo_title;
      }

      const match = window.location.pathname.match(/^\/projects\/([^/]+)$/);
      if (match) {
        const found = data.projects.find((p) => p.slug === match[1]);
        if (found) setSelectedProject(found);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load portfolio data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (routePath.startsWith('/secure-admin')) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [routePath]);

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname || '/';
      setRoutePath(next);
      const match = next.match(/^\/projects\/([^/]+)$/);
      if (match && portfolio) {
        const found = portfolio.projects.find((p) => p.slug === match[1]) || null;
        setSelectedProject(found);
      } else {
        setSelectedProject(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [portfolio]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoutePath(path);
  };

  const handleOpenProject = (proj: ProjectItem) => {
    setSelectedProject(proj);
    navigate(`/projects/${proj.slug}`);
  };

  const handleCloseProject = () => {
    setSelectedProject(null);
    if (routePath.startsWith('/projects/')) {
      navigate('/');
    }
  };

  const handleResumeDownload = async () => {
    try {
      const res = await fetch('/api/public/resume/track', { method: 'POST' });
      const data = await res.json();
      if (data?.resume_url) {
        const a = document.createElement('a');
        a.href = data.resume_url;
        a.download = data.resume_filename || 'Abdullah_Naveed_Resume.pdf';
        a.click();
        return;
      }
    } catch {
      // Fallback to CV Request modal
    }
    setCvModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavigateCitation = (sourceType: string, sourceId: string) => {
    if (sourceType === 'project' && portfolio) {
      const proj = portfolio.projects.find((p) => p.slug === sourceId);
      if (proj) {
        setAiChatOpen(false);
        handleOpenProject(proj);
        return;
      }
    }
    setAiChatOpen(false);
    const map: Record<string, string> = {
      experience: 'experience',
      education: 'credentials',
      certificate: 'credentials',
      skills: 'skills',
      profile: 'about',
    };
    scrollToSection(map[sourceType] || 'projects');
  };

  if (routePath.startsWith('/secure-admin')) {
    return (
      <AdminApp
        onExitAdmin={() => navigate('/')}
        onPortfolioChanged={fetchPortfolio}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060608] text-sm text-slate-400">
        Loading Abdullah Naveed&apos;s Portfolio...
      </div>
    );
  }

  if (loadError || !portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#060608] px-6 text-center">
        <p className="text-sm text-red-400">{loadError || 'Portfolio unavailable.'}</p>
        <button
          type="button"
          onClick={fetchPortfolio}
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-white hover:border-zinc-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const { profile, theme, experience, education, skillUniverse, projects, certificates } = portfolio;

  const hidden = new Set(theme?.hidden_sections || []);
  const defaultOrder = (() => {
    if (profileMode === 'recruiter') {
      return ['story', 'experience', 'credentials', 'projects', 'skills', 'about', 'contact'];
    }
    if (profileMode === 'ai_ml') {
      return ['projects', 'skills', 'story', 'experience', 'credentials', 'about', 'contact'];
    }
    if (profileMode === 'developer') {
      return ['projects', 'skills', 'experience', 'about', 'credentials', 'story', 'contact'];
    }
    const base = theme?.section_order?.length
      ? [...theme.section_order]
      : ['story', 'projects', 'skills', 'experience', 'credentials', 'about', 'contact'];
    if (!base.includes('story')) {
      base.unshift('story');
    }
    return base;
  })();

  const modeCopy = PROFILE_EXPERIENCE_COPY[profileMode];

  const renderSection = (key: string) => {
    if (hidden.has(key)) return null;
    switch (key) {
      case 'story':
        return (
          <FullStorySection
            key="story"
            profile={profile}
            experience={experience}
            education={education}
            projects={projects}
            certificates={certificates}
            onDownloadResume={handleResumeDownload}
            onRequestCv={() => setCvModalOpen(true)}
            onOpenAI={() => setAiChatOpen(true)}
            onSelectProject={handleOpenProject}
          />
        );
      case 'projects':
        return (
          <ProjectCarousel
            key="projects"
            projects={projects}
            profileMode={profileMode}
            onSelectProject={handleOpenProject}
          />
        );
      case 'skills':
        return (
          <SkillsUniverse
            key="skills"
            categories={skillUniverse}
            projects={projects}
            experience={experience}
            onSelectProject={handleOpenProject}
          />
        );
      case 'experience':
        return (
          <ExperienceTimeline
            key="experience"
            companies={experience}
            projects={projects}
            onSelectProject={handleOpenProject}
          />
        );
      case 'credentials':
        return (
          <CredentialsSection
            key="credentials"
            education={education}
            certificates={certificates}
          />
        );
      case 'about':
        return <AboutSection key="about" profile={profile} />;
      case 'contact':
        return (
          <div key="contact">
            <section className="border-t border-zinc-900 bg-[#060608]">
              <div className="mx-auto max-w-[1360px] px-6 py-20 text-center lg:px-10">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-[#e50914] uppercase">
                  The Next Episode
                </p>
                <h2 className="mt-2 font-display text-5xl font-bold tracking-wide text-white uppercase sm:text-7xl">
                  To Be Continued...
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                  Have an idea? Let&apos;s build it. Ready to ship reliable AI engineering, RAG systems, and computer vision products.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToSection('contact-form')}
                    className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0"
                  >
                    <span>Let&apos;s Build</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCvModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-[#e50914]/70 bg-[#e50914]/15 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#e50914]/30 whitespace-nowrap shrink-0"
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-[#e50914]" />
                    <span>Request Official CV</span>
                  </button>
                  {profile.github_url ? (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                    >
                      <span>GitHub</span>
                    </a>
                  ) : null}
                  {profile.linkedin_url ? (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                    >
                      <span>LinkedIn</span>
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIntroDismissed(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-zinc-600 hover:text-white whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay Intro</span>
                  </button>
                </div>
              </div>
            </section>

            <div id="contact-form">
              <ContactSection
                profile={profile}
                onOpenAI={() => setAiChatOpen(true)}
                onRequestCv={() => setCvModalOpen(true)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] text-slate-100">
      {!introDismissed && (theme?.intro_enabled || theme?.profile_selector_enabled) ? (
        <CinematicIntro
          showIntro={Boolean(theme?.intro_enabled)}
          showProfileSelector={Boolean(theme?.profile_selector_enabled)}
          avatarUrl={profile.avatar_url}
          onSelectProfile={(mode) => setProfileMode(mode)}
          onComplete={() => setIntroDismissed(true)}
        />
      ) : null}

      {/* Strict 3-Zone Top Navigation Contract */}
      <header className="sticky top-0 z-30 border-b border-zinc-900/90 bg-[#060608]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-6 py-4 lg:px-10">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-2xl font-bold tracking-wider text-white uppercase whitespace-nowrap shrink-0"
          >
            {profile.full_name}
          </a>

          <nav aria-label="Primary Navigation" className="hidden items-center gap-7 md:flex">
            {[
              { id: 'projects', label: 'Projects' },
              { id: 'skills', label: 'Skills' },
              { id: 'experience', label: 'Experience' },
              { id: 'credentials', label: 'Credentials' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-sm font-medium text-slate-300 underline-offset-8 transition-colors hover:text-white hover:underline whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setAiChatOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[#e50914] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask Abdullah AI</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 text-slate-300 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-zinc-900 bg-[#0A0C11] px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {[
                { id: 'story', label: 'Full Story' },
                { id: 'projects', label: 'Projects' },
                { id: 'skills', label: 'Skills' },
                { id: 'experience', label: 'Experience' },
                { id: 'credentials', label: 'Credentials' },
                { id: 'about', label: 'About' },
                { id: 'contact', label: 'Contact' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className="py-1.5 text-left text-sm font-medium text-slate-200"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero Section with VideoBackgroundLayer + Ambient 3D Canvas */}
      <main id="top">
        <section className="relative overflow-hidden border-b border-zinc-900">
          <VideoBackgroundLayer theme={theme} profileMode={profileMode} />
          <HeroCanvas3D
            enabled={Boolean(theme?.three_d_enabled)}
            accentColor={theme?.accent_color || '#e50914'}
          />

          <div className="relative z-10 mx-auto max-w-[1360px] px-6 pb-14 pt-14 sm:pt-20 lg:px-10">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-between space-y-7 lg:col-span-7"
              >
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-[#e50914] uppercase">
                    {modeCopy.eyebrow}
                  </p>

                  <div>
                    <h1 className="font-display text-6xl font-bold leading-[0.94] tracking-tight text-white uppercase sm:text-7xl lg:text-8xl">
                      {profile.full_name}
                    </h1>
                    <p className="mt-2 font-display text-2xl font-bold tracking-[0.14em] text-[#e50914] uppercase sm:text-3xl">
                      {profile.subheadline}
                    </p>
                  </div>

                  <p className="font-mono text-xs text-slate-400">
                    {profile.location} · BSCS, Superior University · {projects.length} GitHub Systems ·{' '}
                    {experience.length} Orgs · {certificates.length} Certs
                    {profile.availability_enabled ? ` · ${profile.availability_label}` : ''}
                  </p>

                  <p className="max-w-2xl text-base leading-relaxed text-slate-300">
                    {profile.headline}. {profile.bio_short}
                  </p>

                  <p className="text-xs text-slate-400">{modeCopy.summaryNote}</p>
                </div>

                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    {profileMode === 'recruiter' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setCvModalOpen(true)}
                          className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0"
                        >
                          <FileCheck2 className="h-4 w-4 text-[#e50914]" />
                          <span>Request Official CV</span>
                        </button>
                        {profile.resume_url ? (
                          <button
                            type="button"
                            onClick={handleResumeDownload}
                            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14]/90 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                          >
                            <Download className="h-4 w-4" />
                            <span>Public Resume PDF</span>
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => scrollToSection('projects')}
                          className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0"
                        >
                          <Play className="h-4 w-4 fill-zinc-950" />
                          <span>{theme?.hero_cta_primary || 'Explore Work'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCvModalOpen(true)}
                          className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14]/90 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                        >
                          <FileCheck2 className="h-4 w-4 text-[#e50914]" />
                          <span>Request CV</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setAiChatOpen(true)}
                      className="inline-flex items-center gap-2 rounded-md bg-[#e50914] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 whitespace-nowrap shrink-0"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{theme?.hero_cta_secondary || 'Ask Abdullah AI'}</span>
                    </button>
                  </div>

                  {/* Interactive Workspace Perspective Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-4">
                    <span className="mr-2 text-xs text-slate-400">Perspective:</span>
                    {(
                      [
                        { id: 'explore', label: 'Explore Everything' },
                        { id: 'recruiter', label: 'Recruiter' },
                        { id: 'ai_ml', label: 'AI / ML Engineer' },
                        { id: 'developer', label: 'Software Developer' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setProfileMode(mode.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          profileMode === mode.id
                            ? 'bg-zinc-800 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Portrait */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-5"
              >
                <div className="relative h-[400px] overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#060608] sm:h-[440px]">
                  {profile.avatar_url && !portraitFailed ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${profile.full_name} — Artificial Intelligence Engineer`}
                      referrerPolicy="no-referrer"
                      onError={() => setPortraitFailed(true)}
                      className="h-full w-full object-cover object-top opacity-90"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                      <span className="font-display text-6xl font-bold text-slate-700">AN</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/25 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060608] via-black/20 to-transparent" />
                  <div className="absolute bottom-5 left-6 right-6">
                    <p className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                      {profile.full_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-300">
                      {profile.location} · Superior University (BSCS)
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Continue Exploring 5-Episode Strip */}
            <div className="mt-14 border-t border-zinc-900 pt-8">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Continue Exploring
                </h2>
                <span className="text-xs text-slate-400">
                  Jump directly to any episode in the series
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {CONTINUE_EPISODES.map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => scrollToSection(ep.id)}
                    className="group relative overflow-hidden rounded-lg border border-zinc-800/90 bg-[#0D0F14] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-500"
                  >
                    <div className="absolute inset-x-0 bottom-0 h-[2px] w-full bg-zinc-800 transition-colors group-hover:bg-[#e50914]" />
                    <p className="font-mono text-[11px] font-semibold text-[#e50914] uppercase">
                      {ep.episode}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold tracking-wide text-white uppercase">
                      {ep.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{ep.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {defaultOrder.map((sec) => renderSection(sec))}
      </main>

      <footer className="border-t border-zinc-900 bg-[#050507] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {profile.full_name}. Verified Engineering Portfolio.</p>
          <div className="flex items-center gap-6">
            <a
              href={profile.github_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={() => setCvModalOpen(true)}
              className="hover:text-slate-300"
            >
              Request CV
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="hover:text-slate-300"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => navigate('/secure-admin')}
              className="hover:text-slate-300"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </footer>

      <ProjectDetailModal project={selectedProject} onClose={handleCloseProject} />

      <CvRequestModal isOpen={cvModalOpen} onClose={() => setCvModalOpen(false)} />

      <AbdullahAIChat
        isOpen={aiChatOpen}
        onToggle={setAiChatOpen}
        profileMode={profileMode}
        onNavigateCitation={handleNavigateCitation}
        onJumpToContact={() => scrollToSection('contact')}
      />
    </div>
  );
}
