import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ProfileMode } from '../types/portfolio';

interface CinematicIntroProps {
  showIntro: boolean;
  showProfileSelector: boolean;
  avatarUrl?: string;
  onSelectProfile: (mode: ProfileMode) => void;
  onComplete: () => void;
}

const PROFILES: Array<{
  id: ProfileMode;
  label: string;
  subtitle: string;
  monogram: string;
  tileBg: string;
  isPortrait?: boolean;
}> = [
  {
    id: 'explore',
    label: 'Abdullah',
    subtitle: 'The full series, in order',
    monogram: 'AN',
    tileBg: 'bg-zinc-900',
    isPortrait: true,
  },
  {
    id: 'recruiter',
    label: 'Recruiter',
    subtitle: 'Resume, experience & credentials first',
    monogram: 'R',
    tileBg: 'bg-gradient-to-br from-sky-700 to-blue-900',
  },
  {
    id: 'ai_ml',
    label: 'AI / ML Engineer',
    subtitle: 'RAG, LLMs, CV & architectures first',
    monogram: 'AI',
    tileBg: 'bg-gradient-to-br from-emerald-600 to-teal-900',
  },
  {
    id: 'developer',
    label: 'Developer',
    subtitle: 'FastAPI, Next.js, Docker & APIs first',
    monogram: '</>',
    tileBg: 'bg-gradient-to-br from-red-600 to-rose-950',
  },
];

export function CinematicIntro({
  showIntro,
  showProfileSelector,
  avatarUrl,
  onSelectProfile,
  onComplete,
}: CinematicIntroProps) {
  const [stage, setStage] = useState<'brand' | 'profiles'>(showIntro ? 'brand' : 'profiles');
  const brandRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showIntro && !showProfileSelector) {
      onComplete();
      return;
    }
    if (stage !== 'brand') return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      const t = window.setTimeout(() => {
        if (showProfileSelector) setStage('profiles');
        else onComplete();
      }, 250);
      return () => clearTimeout(t);
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          if (showProfileSelector) setStage('profiles');
          else onComplete();
        },
      });
      tl.fromTo(
        '.intro-title',
        { scale: 0.92, opacity: 0, letterSpacing: '0.18em' },
        { scale: 1, opacity: 1, letterSpacing: '0.06em', duration: 0.65, ease: 'power3.out' }
      )
        .fromTo(
          '.intro-sub',
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
          '-=0.25'
        )
        .to('.intro-shell', { opacity: 0, duration: 0.3, delay: 0.45, ease: 'power2.in' });
    }, brandRef);

    return () => ctx.revert();
  }, [stage, showIntro, showProfileSelector, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectProfile('explore');
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComplete, onSelectProfile]);

  if (!showIntro && !showProfileSelector) return null;

  return (
    <div
      ref={brandRef}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio Introduction and Perspective Selector"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060608] px-6 py-10 text-slate-100"
    >
      {/* Subtle Crimson Cinema Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,0.12)_0%,rgba(6,6,8,0.96)_60%,#060608_100%)]"
      />

      <button
        type="button"
        onClick={() => {
          onSelectProfile('explore');
          onComplete();
        }}
        className="absolute right-6 top-6 z-10 rounded-md border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-red-500 whitespace-nowrap shrink-0"
      >
        Skip Intro
      </button>

      {stage === 'brand' ? (
        <div className="intro-shell relative z-10 flex flex-col items-center text-center">
          <h1 className="intro-title font-display text-6xl font-bold tracking-wider text-white uppercase sm:text-8xl">
            ABDULLAH NAVEED
          </h1>
          <p className="intro-sub mt-3 text-xs font-semibold tracking-[0.42em] text-[#e50914] uppercase sm:text-sm">
            The Engineering Series
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <p className="font-display text-xl font-bold tracking-[0.12em] text-white uppercase">
            ABDULLAH NAVEED
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Who&apos;s Exploring?
          </h2>

          <div className="mt-10 grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
            {PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onSelectProfile(profile.id);
                  onComplete();
                }}
                className="group flex flex-col items-center text-center focus-visible:outline-none"
              >
                <div
                  className={`relative aspect-square w-full max-w-[168px] overflow-hidden rounded-lg border-2 border-zinc-800/80 transition-all duration-200 group-hover:scale-105 group-hover:border-white group-focus-visible:border-white ${profile.tileBg}`}
                >
                  {profile.isPortrait && avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.label}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
                        {profile.monogram}
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>

                <span className="mt-3.5 text-sm font-semibold text-slate-200 transition-colors group-hover:text-white">
                  {profile.label}
                </span>
                <span className="mt-1 max-w-[160px] text-xs leading-snug text-slate-500 group-hover:text-slate-300">
                  {profile.subtitle}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-10 max-w-lg text-xs text-slate-500">
            Every profile explores the same verified engineering portfolio — it simply prioritizes what plays first.
          </p>
        </div>
      )}
    </div>
  );
}
