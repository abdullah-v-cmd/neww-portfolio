import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopButtonProps {
  hidden?: boolean;
}

export function BackToTopButton({ hidden = false }: BackToTopButtonProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateScroll = () => {
      const scrollY = window.scrollY || 0;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const ratio = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
      setProgress(ratio);
      setVisible(scrollY > 360);
    };

    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  if (hidden) return null;

  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const handleScrollTop = () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleScrollTop}
      aria-label="Scroll back to top"
      title="Back to top"
      className={`fixed bottom-[4.5rem] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/80 bg-[#0D0F14]/92 text-slate-200 shadow-xl backdrop-blur-md transition-[opacity,transform,border-color,color] duration-300 hover:-translate-y-0.5 hover:border-blue-400 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500 sm:bottom-[4.75rem] sm:right-5 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 44 44"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="url(#backToTopGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
        <defs>
          <linearGradient id="backToTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#e50914" />
          </linearGradient>
        </defs>
      </svg>
      <ArrowUp className="relative h-4 w-4" />
    </button>
  );
}
