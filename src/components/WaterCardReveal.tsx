import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import {
  motion,
  MotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

export interface WaterCardRevealProps {
  children: ReactNode;
  /** Wave stagger slot (0..5) for sequential left-to-right or card-by-card ripple */
  index?: number;
  /** Optional shared scroll progress from a parent row/grid (prevents horizontal offscreen stalls) */
  sharedProgress?: MotionValue<number>;
  className?: string;
  /** Disable animation & show immediately */
  disabled?: boolean;
  /** Show subtle translucent liquid light sheen as element settles */
  sheen?: boolean;
  /** Vertical rise distance in px (default 68 desktop, 44 mobile) */
  risePx?: number;
  /** Optional horizontal glide distance in px (e.g. 36 for horizontal project rails) */
  driftX?: number;
  /** Complete transition higher in the lower viewport for near-footer cards */
  settleEarly?: boolean;
}

function useReducedMotionAndMobile() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return { reduced: false, mobile: false };
    }
    return {
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      mobile: window.innerWidth < 768,
    };
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setState({
        reduced: mq.matches,
        mobile: window.innerWidth < 768,
      });
    };
    update();
    mq.addEventListener?.('change', update);
    window.addEventListener('resize', update, { passive: true });
    return () => {
      mq.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return state;
}

/**
 * Shared scroll-progress hook mapped across the prime visible emergence window
 * (`start 95%` -> `start 32%`) so project rows and card grids visibly rise,
 * un-tilt in 3D perspective, sharpen, and cascade in a clear left-to-right wave
 * right inside the viewport before locking crisp at center.
 */
export function useWaterScrollWave(targetRef: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start 95%', 'start 32%'],
  });

  return useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 25,
    mass: 0.35,
    restDelta: 0.001,
  });
}

function WaterCardInner({
  children,
  index = 0,
  progress,
  className = '',
  sheen = true,
  risePx,
  driftX = 0,
  mobile,
}: {
  children: ReactNode;
  index: number;
  progress: MotionValue<number>;
  className: string;
  sheen: boolean;
  risePx?: number;
  driftX?: number;
  mobile: boolean;
}) {
  const slot = Math.max(0, Math.min(index, 4));
  const enterStart = slot * 0.075;
  const enterMid = enterStart + 0.17;
  const enterEnd = Math.min(enterStart + 0.36, 0.68);

  const lift = risePx ?? (mobile ? 44 : 68);
  const horizontalGlide = mobile ? Math.round(driftX * 0.5) : driftX;
  const startScale = mobile ? 0.89 : 0.85;
  const startRotateX = mobile ? 7 : 11;
  const startRotateY = horizontalGlide > 0 && !mobile ? -5 : 0;
  const blurMax = mobile ? 0 : 10;

  const opacity = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, 1],
    [0.04, 0.06, 0.8, 1, 1]
  );

  const y = useTransform(
    progress,
    [0, enterStart, enterEnd, 1],
    [lift, lift, 0, 0]
  );

  const x = useTransform(
    progress,
    [0, enterStart, enterEnd, 1],
    [horizontalGlide, horizontalGlide, 0, 0]
  );

  const scale = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, 1],
    [startScale, startScale, 0.985, 1, 1]
  );

  const rotateX = useTransform(
    progress,
    [0, enterStart, enterEnd, 1],
    [startRotateX, startRotateX, 0, 0]
  );

  const rotateY = useTransform(
    progress,
    [0, enterStart, enterEnd, 1],
    [startRotateY, startRotateY, 0, 0]
  );

  const filter = useTransform(
    progress,
    [0, enterStart, enterMid, enterEnd, 1],
    blurMax > 0
      ? [
          `blur(${blurMax}px)`,
          `blur(${blurMax}px)`,
          `blur(${(blurMax * 0.25).toFixed(1)}px)`,
          'blur(0px)',
          'blur(0px)',
        ]
      : ['none', 'none', 'none', 'none', 'none']
  );

  const sheenX = useTransform(progress, [enterStart, enterEnd + 0.12], ['-135%', '140%']);
  const sheenOpacity = useTransform(
    progress,
    [enterStart, enterMid, enterEnd + 0.12],
    [0, 0.65, 0]
  );

  return (
    <motion.div
      style={{
        opacity,
        x: horizontalGlide !== 0 ? x : undefined,
        y,
        scale,
        rotateX,
        rotateY: startRotateY !== 0 ? rotateY : undefined,
        transformPerspective: 1100,
        transformOrigin: 'center bottom',
        filter: mobile ? undefined : filter,
      }}
      className={`relative will-change-[transform,opacity] ${className}`}
    >
      {children}
      {sheen ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        >
          <motion.div
            style={{
              x: sheenX,
              opacity: sheenOpacity,
            }}
            className="h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-sky-300/25 to-transparent"
          />
        </div>
      ) : null}
    </motion.div>
  );
}

function LocalWaterCard({
  children,
  index,
  className,
  sheen,
  risePx,
  driftX = 0,
  settleEarly = false,
  mobile,
}: {
  children: ReactNode;
  index: number;
  className: string;
  sheen: boolean;
  risePx?: number;
  driftX?: number;
  settleEarly?: boolean;
  mobile: boolean;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: localRef,
    offset: settleEarly ? ['start 95%', 'start 50%'] : ['start 95%', 'start 32%'],
  });

  const localSmooth = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 25,
    mass: 0.35,
    restDelta: 0.001,
  });

  return (
    <div ref={localRef} className={className}>
      <WaterCardInner
        index={index}
        progress={localSmooth}
        className="h-full"
        sheen={sheen}
        risePx={risePx}
        driftX={driftX}
        mobile={mobile}
      >
        {children}
      </WaterCardInner>
    </div>
  );
}

/**
 * Scroll-driven magical liquid & 3D cinema emergence wrapper for portfolio cards,
 * project items, timelines, credentials, and dossiers.
 */
export function WaterCardReveal({
  children,
  index = 0,
  sharedProgress,
  className = '',
  disabled = false,
  sheen = true,
  risePx,
  driftX = 0,
  settleEarly = false,
}: WaterCardRevealProps) {
  const { reduced, mobile } = useReducedMotionAndMobile();

  if (disabled || reduced) {
    return <div className={className}>{children}</div>;
  }

  if (sharedProgress) {
    return (
      <div className={className}>
        <WaterCardInner
          index={index}
          progress={sharedProgress}
          className="h-full"
          sheen={sheen}
          risePx={risePx}
          driftX={driftX}
          mobile={mobile}
        >
          {children}
        </WaterCardInner>
      </div>
    );
  }

  return (
    <LocalWaterCard
      index={index}
      className={className}
      sheen={sheen}
      risePx={risePx}
      driftX={driftX}
      settleEarly={settleEarly}
      mobile={mobile}
    >
      {children}
    </LocalWaterCard>
  );
}
