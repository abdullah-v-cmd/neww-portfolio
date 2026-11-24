import { useCallback, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  FileCheck2,
  Menu,
  MessageSquare,
  Play,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { PortfolioPayload, ProfileMode, ProjectItem } from './types/portfolio';
import { HeroCanvas3D } from './components/HeroCanvas3D';
import { HeroPortrait3D } from './components/HeroPortrait3D';
import { HeroMontageBackdrop } from './components/HeroMontageBackdrop';
import { VideoBackgroundLayer } from './components/VideoBackgroundLayer';
import { CinematicIntro } from './components/CinematicIntro';
import { MonogramLogo } from './components/MonogramLogo';
import {
  WaterCardReveal,
  WaterFlowText,
  useWaterScrollWave,
} from './components/MotionReveal';
import { BackToTopButton } from './components/BackToTopButton';
import { FullStorySection } from './components/FullStorySection';
import { ProjectCarousel } from './components/ProjectCarousel';
import { ProjectOpeningTransition } from './components/ProjectOpeningTransition';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { CvRequestModal } from './components/CvRequestModal';
import { SkillsUniverse } from './components/SkillsUniverse';
import { ExperienceTimeline } from './components/ExperienceTimeline';
import { CredentialsSection } from './components/CredentialsSection';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { AbdullahAIChat } from './components/AbdullahAIChat';
import { AdminApp } from './components/AdminApp';
import { parseJsonSafe } from './utils/safeFetch';

const CONTINUE_EPISODES = [
  { id: 'story', episode: 'Episode 01', title: 'The Full Story', subtitle: 'Principal Dossier' },
  { id: 'experience', episode: 'Episode 02', title: 'Work Experience', subtitle: '3 Companies' },
  { id: 'skills', episode: 'Episode 03', title: 'Skill Universe', subtitle: 'Interactive Graph' },
  { id: 'projects', episode: 'Episode 04', title: 'Featured Systems', subtitle: 'Originals & Rails' },
  { id: 'credentials', episode: 'Episode 05', title: 'Certificates', subtitle: 'Verified Honors' },
];

const NAV_ITEMS = [
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'about', label: 'About Me' },
  { id: 'contact', label: 'Contact' },
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

function ContinueSeriesRail({
  minimalMotion,
  onSelectEpisode,
}: {
  minimalMotion: boolean;
  onSelectEpisode: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const waveProgress = useWaterScrollWave(gridRef);

  return (
    <section id="continue-series" className="border-b border-zinc-900 bg-[#07080D]">
      <div className="mx-auto max-w-[1360px] px-6 py-10 lg:px-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <WaterFlowText
            as="h2"
            text="Continue Exploring"
            accentVariant="cyan-blue"
            waterIntensity={0.85}
            blurIntensity={6}
            reducedMotion={minimalMotion}
            className="font-display text-2xl font-bold tracking-wide uppercase"
          />
          <span className="text-xs text-slate-400">
            Jump directly to any episode in the series
          </span>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CONTINUE_EPISODES.map((ep, idx) => (
            <WaterCardReveal
              key={ep.id}
              index={idx}
              sharedProgress={waveProgress}
              disabled={minimalMotion}
              className="h-full"
            >
              <button
                type="button"
                onClick={() => onSelectEpisode(ep.id)}
                className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-lg border border-zinc-800/90 bg-[#0D0F14] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/60"
              >
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-full bg-zinc-800 transition-colors group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500" />
                <p className="font-mono text-[11px] font-semibold text-blue-400 uppercase">
                  {ep.episode}
                </p>
                <p className="mt-1 font-display text-xl font-bold tracking-wide text-white uppercase">
                  {ep.title}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{ep.subtitle}</p>
              </button>
            </WaterCardReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

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
  const [openingProject, setOpeningProject] = useState<ProjectItem | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('top');

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/public/portfolio');
      const data = await parseJsonSafe<PortfolioPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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

  // Navbar transparency-to-solid transition
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Active section spy
  useEffect(() => {
    if (routePath.startsWith('/secure-admin') || !portfolio) return;
    const ids = ['top', 'story', 'projects', 'skills', 'experience', 'credentials', 'about', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: 0.01 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [routePath, portfolio]);

  // Smooth scrolling via Lenis (disabled automatically for reduced motion or admin)
  useEffect(() => {
    if (routePath.startsWith('/secure-admin')) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.0,
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
        setOpeningProject(null);
        setSelectedProject(found);
      } else {
        setOpeningProject(null);
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

  const commitProjectModal = useCallback(
    (proj: ProjectItem) => {
      setOpeningProject(null);
      setSelectedProject(proj);
      navigate(`/projects/${proj.slug}`);
    },
    []
  );

  const handleOpenProject = useCallback(
    (proj: ProjectItem) => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dvdEnabled =
        portfolio?.theme?.dvd_transition_enabled !== 0 &&
        portfolio?.theme?.animation_intensity !== 'minimal';

      if (prefersReduced || !dvdEnabled) {
        commitProjectModal(proj);
        return;
      }
      setOpeningProject(proj);
    },
    [portfolio?.theme?.dvd_transition_enabled, portfolio?.theme?.animation_intensity, commitProjectModal]
  );

  const handleCloseProject = () => {
    setOpeningProject(null);
    setSelectedProject(null);
    if (routePath.startsWith('/projects/')) {
      navigate('/');
    }
  };

  const handleIntroComplete = useCallback(() => {
    setIntroDismissed(true);
  }, []);

  const handleResumeDownload = async () => {
    try {
      const res = await fetch('/api/public/resume/track', { method: 'POST' });
      const data = await parseJsonSafe<{ resume_url?: string; resume_filename?: string }>(res);
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
  const minimalMotion = theme?.animation_intensity === 'minimal';
  const isCustomHeroVideoOrImage = theme?.bg_mode === 'video' || theme?.bg_mode === 'image';

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
            videoAutoplayPreview={theme?.video_autoplay_preview !== 0}
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
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-[#e50914] uppercase">
                    The Next Episode · To Be Continued
                  </p>
                  <WaterFlowText
                    as="h2"
                    text="Let's Build Something Extraordinary"
                    accentVariant="cinema"
                    waterIntensity={1.1}
                    blurIntensity={8}
                    reducedMotion={minimalMotion}
                    className="mt-2 text-center font-display text-4xl font-bold tracking-wide uppercase sm:text-6xl lg:text-7xl"
                  />
                  <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                    Have an idea? Let&apos;s build it. Ready to ship reliable AI engineering, RAG systems, and computer vision products.
                  </p>
                </div>

                <WaterCardReveal disabled={minimalMotion} sheen={false} risePx={18}>
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
                </WaterCardReveal>
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
    <div className="min-h-screen overflow-x-hidden bg-[#060608] text-slate-100">
      {!introDismissed && (theme?.intro_enabled || theme?.profile_selector_enabled) ? (
        <CinematicIntro
          showIntro={Boolean(theme?.intro_enabled)}
          showProfileSelector={Boolean(theme?.profile_selector_enabled)}
          avatarUrl={profile.avatar_url}
          onSelectProfile={(mode) => setProfileMode(mode)}
          onComplete={handleIntroComplete}
        />
      ) : null}

      {/* Strict 3-Zone Top Navigation Contract — transparent over hero, solid frosted glass on scroll */}
      <header
        className={`fixed inset-x-0 top-0 z-30 border-b transition-all duration-300 ${
          scrolled || mobileMenuOpen
            ? 'border-zinc-900/95 bg-[#060608]/92 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.65)]'
            : 'border-transparent bg-gradient-to-b from-[#060608]/85 via-[#060608]/45 to-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-6 px-6 py-3.5 lg:px-10">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-3 font-display text-xl font-bold tracking-wider text-white uppercase whitespace-nowrap shrink-0 sm:text-2xl"
          >
            <MonogramLogo size="sm" />
            <span>{profile.full_name}</span>
          </a>

          <nav aria-label="Primary Navigation" className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-transform duration-300 origin-left ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              );
            })}
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
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 bg-[#0A0C12]/80 text-slate-300 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Animated Mobile Navigation Drawer */}
        <div
          className={`overflow-hidden border-t border-zinc-900 bg-[#080A10]/98 backdrop-blur-xl transition-all duration-300 md:hidden ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'pointer-events-none max-h-0 border-t-transparent opacity-0'
          }`}
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {[
              { id: 'story', label: 'Full Story' },
              ...NAV_ITEMS,
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-600/15 text-blue-300'
                    : 'text-slate-200 hover:bg-zinc-900/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top">
        {/* Full-Screen Cinematic Streaming Hero */}
        <section className="relative flex min-h-screen flex-col justify-between overflow-hidden border-b border-zinc-900 pt-20">
          {!isCustomHeroVideoOrImage ? (
            <HeroMontageBackdrop
              theme={theme}
              projects={projects}
              onInspectProject={(slug) => {
                const found = projects.find((p) => p.slug === slug);
                if (found) handleOpenProject(found);
              }}
            />
          ) : null}

          <VideoBackgroundLayer theme={theme} profileMode={profileMode} />
          <HeroCanvas3D
            enabled={Boolean(theme?.three_d_enabled)}
            accentColor={theme?.accent_color || '#3b82f6'}
          />

          <div className="relative z-10 mx-auto my-auto w-full max-w-[1360px] px-6 py-8 lg:px-10">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
              <motion.div
                initial={minimalMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-between space-y-5 lg:col-span-7"
              >
                <div className="space-y-3.5">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-blue-400 uppercase">
                    {modeCopy.eyebrow}
                  </p>

                  <div>
                    <h1 className="water-text-flow font-display text-5xl font-bold leading-[0.94] tracking-tight uppercase sm:text-7xl xl:text-8xl">
                      {profile.full_name}
                    </h1>
                    <p className="mt-2 font-display text-xl font-bold tracking-[0.12em] bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent uppercase sm:text-2xl xl:text-3xl">
                      AI/ML Engineer | Full-Stack Developer | GenAI Engineer
                    </p>
                    <WaterFlowText
                      as="p"
                      text="Turning Ideas Into Intelligent Solutions"
                      scrollActivation={false}
                      waterIntensity={0.85}
                      blurIntensity={6}
                      accentVariant="cyan-blue"
                      reducedMotion={minimalMotion}
                      className="mt-2.5 font-display text-lg font-semibold tracking-wider uppercase sm:text-xl"
                    />
                  </div>

                  <p className="font-mono text-xs text-slate-400">
                    {profile.location} · BSCS, Superior University · {projects.length} GitHub Systems ·{' '}
                    {experience.length} Orgs · {certificates.length} Certs
                    {profile.availability_enabled ? ` · ${profile.availability_label}` : ''}
                  </p>

                  <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                    {profile.bio_short}
                  </p>

                  <p className="text-xs text-slate-400">{modeCopy.summaryNote}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('projects')}
                      className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0"
                    >
                      <Play className="h-4 w-4 fill-zinc-950" />
                      <span>Explore Projects</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollToSection('about')}
                      className="inline-flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-600/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600/30 whitespace-nowrap shrink-0"
                    >
                      <User className="h-4 w-4 text-blue-400" />
                      <span>About Me</span>
                    </button>

                    {profileMode === 'recruiter' && profile.resume_url ? (
                      <button
                        type="button"
                        onClick={handleResumeDownload}
                        className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14]/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                      >
                        <Download className="h-4 w-4" />
                        <span>Resume PDF</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCvModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0D0F14]/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-zinc-500 whitespace-nowrap shrink-0"
                      >
                        <FileCheck2 className="h-4 w-4 text-[#e50914]" />
                        <span>Request CV</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAiChatOpen(true)}
                      className="inline-flex items-center gap-2 rounded-md bg-[#e50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 whitespace-nowrap shrink-0"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Ask Abdullah AI</span>
                    </button>
                  </div>

                  {/* Interactive Workspace Perspective Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-3.5">
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
                            ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white ring-1 ring-blue-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Interactive 3D Spatial Portrait */}
              <motion.div
                initial={minimalMotion ? false : { opacity: 0, y: 18, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-5"
              >
                <HeroPortrait3D
                  avatarUrl={profile.avatar_url}
                  fullName={profile.full_name}
                  subtitle={`${profile.location} · Superior University (BSCS)`}
                  variant="hero"
                  className="lg:h-[420px] xl:h-[455px]"
                />
              </motion.div>
            </div>
          </div>

          {/* Subtle Scroll Indicator */}
          <div className="relative z-10 flex justify-center pb-5 pt-1">
            <button
              type="button"
              onClick={() => scrollToSection('continue-series')}
              className="group inline-flex flex-col items-center gap-1 text-[11px] font-mono tracking-[0.2em] text-slate-400 uppercase transition-colors hover:text-white"
            >
              <span>Scroll to explore</span>
              <ChevronDown className="animate-scroll-chevron h-4 w-4 text-blue-400" />
            </button>
          </div>
        </section>

        {/* Continue Exploring 5-Episode Series Rail */}
        <ContinueSeriesRail
          minimalMotion={minimalMotion}
          onSelectEpisode={scrollToSection}
        />

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
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: minimalMotion ? 'auto' : 'smooth' })}
              className="text-blue-400 hover:text-white"
            >
              Back to Top ↑
            </button>
          </div>
        </div>
      </footer>

      <ProjectOpeningTransition
        project={openingProject}
        onComplete={commitProjectModal}
        onCancel={() => setOpeningProject(null)}
      />

      <ProjectDetailModal project={selectedProject} onClose={handleCloseProject} />

      <CvRequestModal isOpen={cvModalOpen} onClose={() => setCvModalOpen(false)} />

      <BackToTopButton
        hidden={aiChatOpen || Boolean(openingProject) || Boolean(selectedProject) || !introDismissed}
      />

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
