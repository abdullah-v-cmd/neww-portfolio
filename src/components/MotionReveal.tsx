import { ReactNode, useEffect, useRef, useState } from 'react';

interface MotionRevealProps {
  children: ReactNode;
  delayMs?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Lightweight section container reveal. Uses low threshold + scroll-position check
 * so tall sections never stall hidden and always stay immediately reachable.
 */
export function MotionReveal({
  children,
  delayMs = 0,
  disabled = false,
  className = '',
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (disabled || typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (visible || disabled) return;
    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }

    const checkInView = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.98 && rect.bottom >= 0) {
        setVisible(true);
        return true;
      }
      return false;
    };

    if (checkInView()) return;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { threshold: 0, rootMargin: '120px 0px -10px 0px' }
      );
      observer.observe(el);
    }

    const onScroll = () => {
      if (checkInView()) {
        window.removeEventListener('scroll', onScroll);
        observer?.disconnect();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [visible, disabled]);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`transition-[opacity,transform] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface WaterTextProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

/**
 * Liquid water scroll reveal: text rises smoothly through a fluid clip-mask
 * and optical mist settle as it enters the viewport during scrolling.
 */
export function WaterText({
  children,
  delayMs = 0,
  className = '',
}: WaterTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }

    const checkInView = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.96 && rect.bottom >= 0) {
        setVisible(true);
        return true;
      }
      return false;
    };

    if (checkInView()) return;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { threshold: 0, rootMargin: '80px 0px -24px 0px' }
      );
      observer.observe(el);
    }

    const onScroll = () => {
      if (checkInView()) {
        window.removeEventListener('scroll', onScroll);
        observer?.disconnect();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [visible]);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`water-reveal-shell ${visible ? 'is-revealed' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export { WaterFlowText } from './WaterFlowText';
export type { WaterFlowTextProps, WaterFlowAccent } from './WaterFlowText';
export { WaterCardReveal, useWaterScrollWave } from './WaterCardReveal';
export type { WaterCardRevealProps } from './WaterCardReveal';
