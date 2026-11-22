import { useEffect, useMemo, useRef, useState } from 'react';
import { HeroMontageSlide, ProjectItem, ThemeSettings } from '../types/portfolio';

interface HeroMontageBackdropProps {
  theme: ThemeSettings | null | undefined;
  projects: ProjectItem[];
  onInspectProject?: (slug: string) => void;
}

export function HeroMontageBackdrop({
  theme,
  projects,
  onInspectProject,
}: HeroMontageBackdropProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inView, setInView] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const slides: HeroMontageSlide[] = useMemo(() => {
    const adminSlides = Array.isArray(theme?.hero_montage)
      ? theme.hero_montage.filter((s) => s && (s.imageUrl || s.videoUrl))
      : [];
    if (adminSlides.length > 0) return adminSlides;

    // Derive honest project montage strictly from verified featured / key projects with real cover imagery
    const prioritySlugs = [
      'omnisynth',
      'v-watch',
      'ai-ml-60-models',
      'lms-complete',
      'scalable-rag-platform',
    ];
    const picked: ProjectItem[] = [];
    for (const slug of prioritySlugs) {
      const found = projects.find((p) => p.slug === slug && (p.cover_image || p.preview_video_url));
      if (found) picked.push(found);
    }
    for (const p of projects) {
      if (picked.length >= 5) break;
      if (!picked.some((x) => x.id === p.id) && (p.cover_image || p.preview_video_url) && p.status !== 'Experimental') {
        picked.push(p);
      }
    }

    return picked.map((p) => ({
      projectSlug: p.slug,
      title: p.title.split('—')[0].trim(),
      subtitle: p.preview_video_url ? 'Verified Video Demo' : `${p.category} · Verified Visual Frame`,
      category: p.category,
      imageUrl: p.cover_image,
      videoUrl: p.preview_video_url || '',
    }));
  }, [theme?.hero_montage, projects]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || tabHidden || !inView || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [reducedMotion, tabHidden, inView, slides.length]);

  if (theme?.hero_montage_enabled === 0 || slides.length === 0) return null;

  const safeIdx = activeIndex % slides.length;
  const activeSlide = slides[safeIdx];

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {/* Electric blue + midnight purple cinematic atmospheric wash */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_22%,rgba(59,130,246,0.18),transparent_52%),radial-gradient(ellipse_at_82%_28%,rgba(139,92,246,0.16),transparent_52%),radial-gradient(ellipse_at_45%_85%,rgba(229,9,20,0.12),transparent_55%)]"
      />

      {slides.map((slide, idx) => {
        const isActive = idx === safeIdx;
        return (
          <div
            key={`${slide.title}-${idx}`}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              isActive ? 'opacity-30' : 'opacity-0'
            }`}
          >
            {isActive && slide.videoUrl && !reducedMotion && inView && !tabHidden ? (
              <video
                src={slide.videoUrl}
                poster={slide.imageUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                loading={idx === 0 ? 'eager' : 'lazy'}
                className={`h-full w-full object-cover ${
                  isActive && !reducedMotion ? 'animate-kenburns' : ''
                }`}
              />
            ) : null}
          </div>
        );
      })}

      {/* Deep cinema contrast gradient scrim */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#060608]/95 via-[#060608]/78 to-[#060608]/65" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent to-[#060608]/80" />

      {/* Subtle montage showcase caption pill/strip (interactive click to inspect featured project) */}
      {activeSlide ? (
        <div className="pointer-events-auto absolute bottom-5 right-6 z-20 hidden items-center gap-3 rounded-lg border border-white/10 bg-[#080B13]/80 px-3.5 py-2 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-1.5" aria-label="Hero montage slides">
            {slides.map((s, i) => (
              <button
                key={`${s.title}-dot-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show montage frame: ${s.title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === safeIdx
                    ? 'w-6 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500'
                    : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>
          <span className="h-3.5 w-px bg-zinc-700" aria-hidden="true" />
          <button
            type="button"
            onClick={() => activeSlide.projectSlug && onInspectProject?.(activeSlide.projectSlug)}
            className="text-left font-mono text-[11px] text-slate-300 transition-colors hover:text-white"
          >
            <span className="text-blue-400">0{safeIdx + 1}</span>
            <span className="mx-1.5 text-zinc-600">/</span>
            <span className="font-semibold text-white">{activeSlide.title}</span>
            <span className="ml-2 text-slate-400">· {activeSlide.subtitle}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
