interface MonogramLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
};

export function MonogramLogo({ size = 'md', className = '' }: MonogramLogoProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-blue-500/35 bg-[#080b14] shadow-[0_0_24px_rgba(59,130,246,0.22)] shrink-0 ${SIZE_MAP[size]} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="an-rim" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#e50914" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="7" stroke="url(#an-rim)" strokeOpacity="0.55" strokeWidth="1.2" />
        {/* Sharp architectural A */}
        <path
          d="M8.5 29L15 11H18.2L23.2 29M10.7 23.2H21"
          stroke="#F8FAFC"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Connected N */}
        <path
          d="M23.5 29V11L31.5 29V11"
          stroke="url(#an-rim)"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
