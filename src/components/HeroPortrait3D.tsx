import { PointerEvent, useEffect, useRef, useState } from 'react';

interface HeroPortrait3DProps {
  avatarUrl?: string;
  fullName: string;
  subtitle: string;
  variant?: 'hero' | 'about';
  className?: string;
}

export function HeroPortrait3D({
  avatarUrl,
  fullName,
  subtitle,
  variant = 'hero',
  className = '',
}: HeroPortrait3DProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [tilt, setTilt] = useState({ rx: -2, ry: 5, gx: 50, gy: 35, hovered: false });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const ry = (px - 0.5) * 20; // -10deg to +10deg
    const rx = (0.5 - py) * 16; // -8deg to +8deg
    setTilt({
      rx,
      ry,
      gx: Math.round(px * 100),
      gy: Math.round(py * 100),
      hovered: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({
      rx: variant === 'hero' ? -2 : 0,
      ry: variant === 'hero' ? 5 : 0,
      gx: 50,
      gy: 35,
      hovered: false,
    });
  };

  const heightClass =
    variant === 'hero' ? 'h-[410px] sm:h-[460px]' : 'aspect-[4/5] w-full';

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || 'AN';

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`group relative select-none ${heightClass} ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* Ambient grounded floor shadow shifting with tilt */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-5 left-6 right-6 h-10 rounded-full bg-black/80 blur-2xl transition-transform duration-300 ease-out"
        style={{
          transform: reducedMotion
            ? undefined
            : `translate3d(${-tilt.ry * 1.1}px, 0px, 0px) scale(${tilt.hovered ? 0.96 : 0.9})`,
        }}
      />

      {/* 3D Tilting Assembly */}
      <div
        className="relative h-full w-full transition-transform ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transitionDuration: tilt.hovered ? '90ms' : '480ms',
          transform: reducedMotion
            ? undefined
            : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(${tilt.hovered ? 8 : 0}px)`,
        }}
      >
        {/* Back Spatial Depth Plate */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-2xl border border-red-500/25 bg-gradient-to-br from-[#2a0a10] via-[#0d1018] to-[#080b14]"
          style={{
            transform: 'translateZ(-26px) translate3d(10px, 12px, 0px)',
          }}
        />

        {/* Subtle Secondary Offset Rim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/20 via-red-500/35 to-sky-500/20 opacity-80"
          style={{
            transform: 'translateZ(-4px)',
          }}
        />

        {/* Primary Portrait Canvas */}
        <div
          className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-[#090B10] shadow-[0_28px_70px_-15px_rgba(0,0,0,0.85)]"
          style={{ transform: 'translateZ(0px)' }}
        >
          {avatarUrl && !imgFailed ? (
            <img
              src={avatarUrl}
              alt={`${fullName} — Artificial Intelligence Engineer`}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
              <span className="font-display text-6xl font-bold text-slate-600">{initials}</span>
            </div>
          )}

          {/* Measured bottom readability scrim only — keeps upper portrait crisp & luminous */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#060608] via-[#060608]/55 to-transparent" />

          {/* Interactive Specular Glass Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: tilt.hovered ? 0.45 : 0.18,
              background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.32), rgba(229,9,20,0.08) 32%, transparent 65%)`,
            }}
          />
        </div>

        {/* Floating Architectural Corner Frame (Z+18px) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 h-7 w-7 border-r-2 border-t-2 border-red-500/80"
          style={{ transform: 'translateZ(20px)' }}
        />

        {/* Floating Foreground Nameplate (Z+34px) */}
        <div
          className="pointer-events-none absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-[#080A0F]/80 px-4 py-3 backdrop-blur-md shadow-xl"
          style={{ transform: 'translateZ(34px)' }}
        >
          <p className="font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
            {fullName}
          </p>
          <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
