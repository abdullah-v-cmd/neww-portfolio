import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ProfileMode } from '../types/portfolio';
import { MonogramLogo } from './MonogramLogo';

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
    subtitle: 'Full story & complete catalog',
    monogram: 'AN',
    tileBg: 'bg-zinc-900',
    isPortrait: true,
  },
  {
    id: 'recruiter',
    label: 'Recruiter',
    subtitle: 'Resume, CV request & experience',
    monogram: 'R',
    tileBg: 'bg-gradient-to-br from-sky-700 to-blue-950',
  },
  {
    id: 'ai_ml',
    label: 'AI / ML Engineer',
    subtitle: 'RAG, LLMs & CV architectures',
    monogram: 'AI',
    tileBg: 'bg-gradient-to-br from-emerald-600 to-teal-950',
  },
  {
    id: 'developer',
    label: 'Developer',
    subtitle: 'FastAPI, Next.js & Docker stacks',
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
  const [transitioningTo, setTransitioningTo] = useState<ProfileMode | null>(null);
  const [exiting, setExiting] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const profilesContainerRef = useRef<HTMLDivElement | null>(null);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Brand splash timeline — deliberate, cinematic GSAP reveal
  useEffect(() => {
    if (!showIntro && !showProfileSelector) {
      onComplete();
      return;
    }
    if (stage !== 'brand') return;

    if (prefersReduced) {
      const t = window.setTimeout(() => {
        if (showProfileSelector) setStage('profiles');
        else onComplete();
      }, 300);
      return () => clearTimeout(t);
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          if (showProfileSelector) {
            setStage('profiles');
          } else {
            onComplete();
          }
        },
      });

      tl.fromTo(
        '.intro-line',
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.75, ease: 'power3.inOut' }
      )
        .fromTo(
          '.intro-title',
          { y: 18, scale: 0.94, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.95, ease: 'power3.out' },
          '-=0.45'
        )
        .fromTo(
          '.intro-sub',
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' },
          '-=0.5'
        )
        .to('.intro-shell', {
          y: -10,
          opacity: 0,
          duration: 0.65,
          delay: 0.7,
          ease: 'power2.inOut',
        });
    }, rootRef);

    return () => ctx.revert();
  }, [stage, showIntro, showProfileSelector, onComplete, prefersReduced]);

  // Smooth staggered reveal for profile selector tiles
  useEffect(() => {
    if (stage !== 'profiles' || prefersReduced || !profilesContainerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.profile-heading',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.profile-tile',
        { y: 20, scale: 0.94, opacity: 0 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.55,
          stagger: 0.08,
          delay: 0.12,
          ease: 'power3.out',
        }
      );
    }, profilesContainerRef);

    return () => ctx.revert();
  }, [stage, prefersReduced]);

  const finishWithTransition = (mode: ProfileMode) => {
    if (transitioningTo || exiting) return;
    setTransitioningTo(mode);
    onSelectProfile(mode);

    if (prefersReduced) {
      onComplete();
      return;
    }

    // Play smooth 620ms profile zoom + cross-dissolve before unveiling main viewport
    window.setTimeout(() => {
      setExiting(true);
    }, 360);

    window.setTimeout(() => {
      onComplete();
    }, 760);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !transitioningTo) {
        finishWithTransition('explore');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!showIntro && !showProfileSelector) return null;

  const selectedLabel = PROFILES.find((p) => p.id === transitioningTo)?.label;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio Introduction and Perspective Selector"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060608] px-6 py-10 text-slate-100 transition-all duration-500 ease-out ${
        exiting ? 'pointer-events-none scale-[1.03] opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      {/* Subtle Crimson Cinema Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,0.14)_0%,rgba(6,6,8,0.96)_62%,#060608_100%)]"
      />

      {!transitioningTo ? (
        <button
          type="button"
          onClick={() => finishWithTransition('explore')}
          className="absolute right-6 top-6 z-20 rounded-md border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-red-500 whitespace-nowrap shrink-0"
        >
          Skip Intro
        </button>
      ) : null}

      {stage === 'brand' ? (
        <div className="intro-shell relative z-10 flex flex-col items-center text-center">
          <MonogramLogo size="lg" className="intro-sub mb-5" />
          <div className="intro-line mb-5 h-[2px] w-20 origin-center bg-gradient-to-r from-blue-500 via-purple-500 to-[#e50914]" />
          <h1 className="intro-title font-display text-5xl font-bold tracking-[0.06em] text-white uppercase sm:text-8xl">
            ABDULLAH NAVEED
          </h1>
          <p className="intro-sub mt-3 text-xs font-semibold tracking-[0.4em] text-blue-400 uppercase sm:text-sm">
            AI/ML · Full-Stack · GenAI Systems
          </p>
        </div>
      ) : (
        <div
          ref={profilesContainerRef}
          className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center"
        >
          <div className="profile-heading">
            <p className="font-display text-xl font-bold tracking-[0.14em] text-white uppercase">
              ABDULLAH NAVEED
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {transitioningTo ? `Loading ${selectedLabel} View…` : 'Who’s Exploring?'}
            </h2>
          </div>

          <div className="mt-10 grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
            {PROFILES.map((profile) => {
              const isChosen = transitioningTo === profile.id;
              const isDimmed = Boolean(transitioningTo && !isChosen);

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={Boolean(transitioningTo)}
                  onClick={() => finishWithTransition(profile.id)}
                  className={`profile-tile group flex flex-col items-center text-center transition-all duration-500 ease-out focus-visible:outline-none ${
                    isChosen
                      ? 'scale-110 z-20'
                      : isDimmed
                      ? 'scale-90 opacity-20 blur-[1px]'
                      : 'hover:-translate-y-1'
                  }`}
                >
                  <div
                    className={`relative aspect-square w-full max-w-[168px] overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                      isChosen
                        ? 'border-[#e50914] shadow-[0_0_40px_rgba(229,9,20,0.45)]'
                        : 'border-zinc-800/80 group-hover:scale-105 group-hover:border-white group-focus-visible:border-white'
                    } ${profile.tileBg}`}
                  >
                    {profile.isPortrait && avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profile.label}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
                          {profile.monogram}
                        </span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  </div>

                  <span
                    className={`mt-3.5 text-sm font-semibold transition-colors ${
                      isChosen ? 'text-[#e50914]' : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {profile.label}
                  </span>
                  <span className="mt-1 max-w-[164px] text-xs leading-snug text-slate-500 group-hover:text-slate-300">
                    {profile.subtitle}
                  </span>
                </button>
              );
            })}
          </div>

          <p
            className={`mt-10 max-w-lg text-xs transition-opacity duration-300 ${
              transitioningTo ? 'text-red-400 opacity-100' : 'text-slate-500 opacity-100'
            }`}
          >
            {transitioningTo
              ? 'Preparing section sequence, flagship project highlights, and workspace perspective…'
              : 'Every profile explores the same verified portfolio — it prioritizes what plays first.'}
          </p>
        </div>
      )}
    </div>
  );
}
