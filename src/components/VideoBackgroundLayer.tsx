import { useEffect, useRef, useState } from 'react';
import { ProfileMode, ThemeSettings } from '../types/portfolio';

interface VideoBackgroundLayerProps {
  theme: ThemeSettings | null | undefined;
  profileMode: ProfileMode;
}

export function VideoBackgroundLayer({ theme, profileMode }: VideoBackgroundLayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const override = theme?.profile_backgrounds?.[profileMode];
  const bgMode = override?.bg_mode || theme?.bg_mode || 'default';
  const desktopVideoUrl = override?.bg_video_url || theme?.bg_video_url || '';
  const mobileVideoUrl = override?.bg_mobile_video_url || theme?.bg_mobile_video_url || '';
  const posterUrl = override?.bg_poster_url || theme?.bg_poster_url || '';
  const imageUrl = override?.bg_image_url || theme?.bg_image_url || '';
  const gradientCss = override?.bg_gradient_css || theme?.bg_gradient_css || '';
  const overlayOpacity =
    typeof override?.bg_overlay_opacity === 'number'
      ? override.bg_overlay_opacity
      : typeof theme?.bg_overlay_opacity === 'number'
      ? theme.bg_overlay_opacity
      : 0.72;

  const activeVideoUrl = isMobile && mobileVideoUrl ? mobileVideoUrl : desktopVideoUrl;

  useEffect(() => {
    setVideoFailed(false);
  }, [activeVideoUrl, bgMode]);

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setIsMobile(mqMobile.matches);
      setPrefersReducedMotion(mqReduced.matches);
    };
    update();
    mqMobile.addEventListener('change', update);
    mqReduced.addEventListener('change', update);
    return () => {
      mqMobile.removeEventListener('change', update);
      mqReduced.removeEventListener('change', update);
    };
  }, []);

  // Pause background video cleanly when browser tab is hidden to save battery/CPU
  useEffect(() => {
    const onVisibility = () => {
      const el = videoRef.current;
      if (!el) return;
      if (document.hidden) {
        el.pause();
      } else if (!prefersReducedMotion && !videoFailed) {
        el.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [prefersReducedMotion, videoFailed]);

  if (bgMode === 'default') return null;

  const fallbackImg = posterUrl || imageUrl;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {bgMode === 'gradient' ? (
        <div
          className="h-full w-full"
          style={{
            background:
              gradientCss ||
              'radial-gradient(ellipse at 25% 20%, rgba(229,9,20,0.22), transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(30,58,138,0.24), transparent 50%), #060608',
          }}
        />
      ) : null}

      {bgMode === 'image' && imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
        />
      ) : null}

      {bgMode === 'video' ? (
        prefersReducedMotion || videoFailed || !activeVideoUrl ? (
          fallbackImg ? (
            <img
              src={fallbackImg}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null
        ) : (
          <video
            ref={videoRef}
            key={activeVideoUrl}
            src={activeVideoUrl}
            poster={posterUrl || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            className="h-full w-full object-cover"
          />
        )
      ) : null}

      {/* Dark Cinema Readability Scrim */}
      <div
        className="absolute inset-0 bg-[#060608]"
        style={{ opacity: Math.min(0.95, Math.max(0.2, overlayOpacity)) }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent to-[#060608]/60" />
    </div>
  );
}
