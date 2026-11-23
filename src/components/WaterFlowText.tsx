import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  motion,
  MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

export type WaterFlowAccent = 'cyan-blue' | 'blue-purple' | 'cinema';

export interface WaterFlowTextProps {
  /** Primary string content; enables word-level staggered water emergence */
  text?: string;
  /** Optional custom JSX children when rich markup is needed */
  children?: ReactNode;
  /** Semantic HTML tag */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  /** Tailwind / custom typography classes */
  className?: string;
  /** Optional explicit CSS font-size override */
  fontSize?: string;
  /** Optional solid text color override (defaults to animated electric water palette) */
  color?: string;
  /** Controls liquid displacement & wave strength (default 1, range 0..2) */
  waterIntensity?: number;
  /** Controls animation/spring duration rhythm in seconds (default 0.9) */
  duration?: number;
  /** Bind reveal & ripples directly to scroll progress (false settles smoothly on mount) */
  scrollActivation?: boolean;
  /** Multiplier for turbulence oscillation and light sheen speed (default 1) */
  waveSpeed?: number;
  /** Maximum mist blur in px before text sharpens (default 8) */
  blurIntensity?: number;
  /** Manual reduced-motion override; automatically respects OS prefers-reduced-motion */
  reducedMotion?: boolean;
  /** Stagger individual words on scroll (default true when `text` is provided) */
  staggerWords?: boolean;
  /** Color reflection accent preset */
  accentVariant?: WaterFlowAccent;
  /** Render subtle scrolling caustic underline & optical flecks on desktop */
  showCaustics?: boolean;
}

type DeviceTier = 'desktop' | 'tablet' | 'mobile';

function detectDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getAccentGradientClass(variant: WaterFlowAccent): string {
  switch (variant) {
    case 'blue-purple':
      return 'water-ink-blue-purple';
    case 'cinema':
      return 'water-ink-cinema';
    case 'cyan-blue':
    default:
      return 'water-ink-cyan-blue';
  }
}

interface WaterWordProps {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  waterIntensity: number;
  blurIntensity: number;
  inkClass: string;
  customColor?: string;
  reducedMotion: boolean;
  isMobile: boolean;
}

function WaterWord({
  word,
  index,
  total,
  progress,
  waterIntensity,
  blurIntensity,
  inkClass,
  customColor,
  reducedMotion,
  isMobile,
}: WaterWordProps) {
  const safeTotal = Math.max(total - 1, 1);
  const ratio = index / safeTotal;
  const enterStart = Math.min(ratio * 0.065, 0.075);
  const enterMid = enterStart + 0.048;
  const enterEnd = Math.min(enterStart + 0.098, 0.175);
  const exitStart = 0.86 - ratio * 0.025;

  const waveLift = isMobile ? 12 : Math.round(18 * waterIntensity);
  const wordBlurMax = isMobile
    ? Math.min(4, blurIntensity * 0.5)
    : Math.min(14, blurIntensity * 0.85);

  const opacity = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, exitStart, 1],
    [0.14, 0.22, 0.84, 1, 1, 0.45]
  );

  const y = useTransform(
    progress,
    [0, enterStart, enterEnd, exitStart, 1],
    [waveLift, waveLift * 0.82, 0, 0, -Math.round(waveLift * 0.45)]
  );

  const scale = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, exitStart, 1],
    [0.94, 0.95, 1.015, 1, 1, 0.97]
  );

  const filter = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, exitStart, 1],
    [
      `blur(${wordBlurMax.toFixed(1)}px)`,
      `blur(${(wordBlurMax * 0.78).toFixed(1)}px)`,
      `blur(${(wordBlurMax * 0.22).toFixed(1)}px)`,
      'blur(0px)',
      'blur(0px)',
      `blur(${(wordBlurMax * 0.35).toFixed(1)}px)`,
    ]
  );

  if (reducedMotion) {
    return (
      <span
        className={`inline-block select-text ${customColor ? '' : inkClass}`}
        style={customColor ? { color: customColor } : undefined}
      >
        {word}
      </span>
    );
  }

  return (
    <motion.span
      style={{
        opacity,
        y,
        scale,
        filter,
        color: customColor || undefined,
      }}
      className={`inline-block select-text will-change-[transform,opacity,filter] ${
        customColor ? '' : inkClass
      }`}
    >
      {word}
    </motion.span>
  );
}

/**
 * Scroll-driven Magical Water-Flow Typography component.
 *
 * Combines Framer Motion (`motion/react`) scroll progress with responsive SVG
 * liquid displacement (`feTurbulence` + `feDisplacementMap`) on desktop/tablet,
 * lightweight GPU transforms on mobile, offscreen pausing, and static reduced-motion fallback.
 */
export function WaterFlowText({
  text,
  children,
  as = 'h2',
  className = '',
  fontSize,
  color,
  waterIntensity = 1,
  duration = 0.9,
  scrollActivation = true,
  waveSpeed = 1,
  blurIntensity = 8,
  reducedMotion,
  staggerWords = true,
  accentVariant = 'cyan-blue',
  showCaustics = true,
}: WaterFlowTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liquidSurfaceRef = useRef<HTMLSpanElement | null>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement | null>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const latestDisplacementRef = useRef<number>(0);

  const rawId = useId().replace(/:/g, '');
  const filterId = `water-flow-filter-${rawId}`;

  const [deviceTier, setDeviceTier] = useState<DeviceTier>(detectDeviceTier);
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isInView, setIsInView] = useState<boolean>(!scrollActivation);

  const effectiveReducedMotion = Boolean(reducedMotion) || osReducedMotion;
  const clampedIntensity = Math.max(0, Math.min(waterIntensity, 2));
  const clampedDuration = Math.max(0.35, Math.min(duration, 2.2));
  const clampedWaveSpeed = Math.max(0.25, Math.min(waveSpeed, 2.5));
  const clampedBlur = Math.max(0, Math.min(blurIntensity, 18));

  // Responsive tier & prefers-reduced-motion listeners
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMqChange = () => setOsReducedMotion(mq.matches);
    onMqChange();
    mq.addEventListener?.('change', onMqChange);

    const onResize = () => setDeviceTier(detectDeviceTier());
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      mq.removeEventListener?.('change', onMqChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Track visibility so offscreen SVG turbulence animation pauses cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries.some((entry) => entry.isIntersecting));
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll-progress pipeline (no React re-renders per scroll frame)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 98%', 'end 2%'],
  });

  // Fallback MotionValue for non-scroll-activated hero mode (smooth liquid mount settle)
  const mountProgress = useMotionValue(scrollActivation || effectiveReducedMotion ? 0.5 : 0.02);

  useEffect(() => {
    if (scrollActivation) return;
    if (effectiveReducedMotion) {
      mountProgress.set(0.5);
      return;
    }
    mountProgress.set(0.02);
    const raf = requestAnimationFrame(() => {
      mountProgress.set(0.45);
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollActivation, effectiveReducedMotion, mountProgress]);

  const rawProgress = scrollActivation ? scrollYProgress : mountProgress;
  const smoothProgress = useSpring(rawProgress, {
    stiffness: Math.round(240 / clampedDuration),
    damping: 28,
    mass: 0.35,
    restDelta: 0.002,
  });

  // Whole-container subtle mist & caustic progression (for children mode or underline)
  const containerOpacity = useTransform(
    smoothProgress,
    [0, 0.07, 0.17, 0.86, 1],
    [0.16, 0.76, 1, 1, 0.46]
  );
  const containerY = useTransform(
    smoothProgress,
    [0, 0.17, 0.86, 1],
    [deviceTier === 'mobile' ? 12 : Math.round(18 * clampedIntensity), 0, 0, -10]
  );
  const containerBlur = useTransform(
    smoothProgress,
    [0, 0.08, 0.175, 0.86, 1],
    [
      `blur(${(deviceTier === 'mobile' ? Math.min(4, clampedBlur * 0.5) : clampedBlur).toFixed(1)}px)`,
      `blur(${(clampedBlur * 0.36).toFixed(1)}px)`,
      'blur(0px)',
      'blur(0px)',
      `blur(${(clampedBlur * 0.4).toFixed(1)}px)`,
    ]
  );
  const causticScaleX = useTransform(smoothProgress, [0.02, 0.19, 0.85, 1], [0.08, 1, 1, 0.25]);
  const causticOpacity = useTransform(smoothProgress, [0, 0.08, 0.22, 0.84, 1], [0, 0.85, 0.6, 0.55, 0]);

  const useSvgLiquidFilter =
    !effectiveReducedMotion && deviceTier !== 'mobile' && clampedIntensity > 0.05;
  const maxDisplacementScale =
    deviceTier === 'tablet' ? 11 * clampedIntensity : 21 * clampedIntensity;

  const waveRafRef = useRef<number>(0);
  const waveStartRef = useRef<number>(0);
  const waveLastTickRef = useRef<number>(0);

  const stopWaveLoop = () => {
    if (waveRafRef.current) {
      cancelAnimationFrame(waveRafRef.current);
      waveRafRef.current = 0;
    }
  };

  const startWaveLoop = () => {
    if (waveRafRef.current || !useSvgLiquidFilter || !isInView) return;
    waveStartRef.current = performance.now();
    waveLastTickRef.current = 0;
    const step = (now: number) => {
      if (document.hidden || latestDisplacementRef.current < 0.25 || !isInView) {
        waveRafRef.current = 0;
        return;
      }
      if (turbulenceRef.current && now - waveLastTickRef.current >= 33) {
        waveLastTickRef.current = now;
        const t = ((now - waveStartRef.current) / 1000) * clampedWaveSpeed;
        const bfX = (0.015 + Math.sin(t * 1.45) * 0.0045).toFixed(4);
        const bfY = (0.048 + Math.cos(t * 1.15) * 0.014).toFixed(4);
        turbulenceRef.current.setAttribute('baseFrequency', `${bfX} ${bfY}`);
      }
      waveRafRef.current = requestAnimationFrame(step);
    };
    waveRafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!isInView || !useSvgLiquidFilter) {
      stopWaveLoop();
    }
    return () => stopWaveLoop();
  }, [isInView, useSvgLiquidFilter]);

  // Map scroll progress directly to SVG feDisplacementMap scale without triggering React state updates
  useMotionValueEvent(smoothProgress, 'change', (p) => {
    const surface = liquidSurfaceRef.current;
    const disp = displacementRef.current;
    if (!surface) return;

    if (!useSvgLiquidFilter) {
      if (surface.style.filter !== '') surface.style.filter = '';
      latestDisplacementRef.current = 0;
      stopWaveLoop();
      return;
    }

    let scale = 0;
    if (p < 0.18) {
      // Peaks near entrance ripple (p ~ 0.06) then smoothly clears to 0
      const t = Math.max(0, Math.min(1, p / 0.18));
      const envelope = Math.sin(Math.pow(1 - t, 0.85) * Math.PI * 0.85);
      scale = maxDisplacementScale * Math.max(0, envelope);
    } else if (p > 0.86) {
      const t = Math.max(0, Math.min(1, (p - 0.86) / 0.14));
      scale = maxDisplacementScale * 0.65 * Math.sin(t * Math.PI * 0.65);
    } else {
      scale = 0;
    }

    latestDisplacementRef.current = scale;

    if (scale < 0.25) {
      // Remove SVG filter completely in settled reading zone for razor-sharp text
      if (surface.style.filter !== 'none') {
        surface.style.filter = 'none';
      }
      stopWaveLoop();
    } else {
      if (disp) disp.setAttribute('scale', scale.toFixed(2));
      const targetFilter = `url(#${filterId})`;
      if (surface.style.filter !== targetFilter) {
        surface.style.filter = targetFilter;
      }
      startWaveLoop();
    }
  });

  const words = useMemo(() => {
    if (!text || !staggerWords) return null;
    return text.trim().split(/\s+/).filter(Boolean);
  }, [text, staggerWords]);

  const inkClass = getAccentGradientClass(accentVariant);
  const Tag = as;
  const sheenDurationSec = (7.2 / clampedWaveSpeed).toFixed(2);
  const isCentered = className.includes('text-center');
  const seed = useMemo(() => {
    let hash = 7;
    const src = text || 'waterflow';
    for (let i = 0; i < src.length; i += 1) {
      hash = (hash * 31 + src.charCodeAt(i)) % 997;
    }
    return hash;
  }, [text]);

  return (
    <div ref={containerRef} className="relative max-w-full overflow-x-clip">
      {/* Per-instance lightweight SVG liquid displacement filter (Desktop/Tablet only) */}
      {useSvgLiquidFilter ? (
        <svg
          className="pointer-events-none absolute h-0 w-0 overflow-hidden"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <filter
              id={filterId}
              x="-10%"
              y="-28%"
              width="120%"
              height="156%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                ref={turbulenceRef}
                type="fractalNoise"
                baseFrequency="0.015 0.048"
                numOctaves={deviceTier === 'tablet' ? 1 : 2}
                seed={seed}
                result="waterNoise"
              />
              <feDisplacementMap
                ref={displacementRef}
                in="SourceGraphic"
                in2="waterNoise"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      ) : null}

      <Tag
        className={`relative select-text ${className}`}
        style={{
          ...(fontSize ? { fontSize } : {}),
          ['--water-sheen-duration' as string]: `${sheenDurationSec}s`,
        }}
        aria-label={text || undefined}
      >
        <span ref={liquidSurfaceRef} className="inline-block max-w-full">
          {words && words.length > 0 ? (
            words.map((word, idx) => (
              <span key={`${idx}-${word}`}>
                <WaterWord
                  word={word}
                  index={idx}
                  total={words.length}
                  progress={smoothProgress}
                  waterIntensity={clampedIntensity}
                  blurIntensity={clampedBlur}
                  inkClass={inkClass}
                  customColor={color}
                  reducedMotion={effectiveReducedMotion}
                  isMobile={deviceTier === 'mobile'}
                />
                {idx < words.length - 1 ? ' ' : null}
              </span>
            ))
          ) : effectiveReducedMotion ? (
            <span style={color ? { color } : undefined} className={color ? '' : inkClass}>
              {text ?? children}
            </span>
          ) : (
            <motion.span
              style={{
                opacity: containerOpacity,
                y: containerY,
                filter: containerBlur,
                color: color || undefined,
              }}
              className={`inline-block will-change-[transform,opacity,filter] ${
                color ? '' : children ? '' : inkClass
              }`}
            >
              {text ?? children}
            </motion.span>
          )}
        </span>
      </Tag>

      {/* Subtle controlled liquid caustic refraction line */}
      {showCaustics && !effectiveReducedMotion ? (
        <motion.div
          aria-hidden="true"
          style={{
            scaleX: causticScaleX,
            opacity: causticOpacity,
          }}
          className={`water-caustic-bar pointer-events-none mt-2 h-[2px] w-28 rounded-full ${
            isCentered ? 'mx-auto origin-center' : 'origin-left'
          }`}
        />
      ) : null}
    </div>
  );
}
