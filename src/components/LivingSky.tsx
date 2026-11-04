import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export const LivingSky: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isTabVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 15 sparse petals for calm, non-distracting atmospheric depth
    const PETAL_COUNT = 15;
    const petals = Array.from({ length: PETAL_COUNT }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 6 + 5,
      speedX: Math.random() * 0.8 + 0.4,
      speedY: Math.random() * 1.0 + 0.6,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 1.5,
      opacity: Math.random() * 0.4 + 0.3
    }));

    const render = () => {
      if (isTabVisible && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const isDark = document.documentElement.classList.contains('dark');
        const petalColor = isDark ? '255, 143, 177' : '247, 168, 196';

        for (const p of petals) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = `rgba(${petalColor}, ${p.opacity})`;

          // Draw soft sakura petal curve
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(p.size / 2, -p.size / 2, p.size, 0, 0, p.size);
          ctx.bezierCurveTo(-p.size, 0, -p.size / 2, -p.size / 2, 0, 0);
          ctx.fill();
          ctx.restore();

          p.x += p.speedX;
          p.y += p.speedY;
          p.rotation += p.rotationSpeed;

          // Wrap around screen edges
          if (p.y > canvas.height + 20) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
          if (p.x > canvas.width + 20) {
            p.x = -20;
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Drifting Clouds (CSS layered) */}
      <div className="absolute inset-0 opacity-40 dark:opacity-20 transition-opacity duration-700">
        <svg className="absolute w-[200%] h-full animate-[drift_90s_linear_infinite]" viewBox="0 0 1600 400" fill="none">
          <path
            d="M150 120 Q 220 60 300 120 Q 380 70 460 130 Q 520 180 480 230 Q 420 280 320 260 Q 200 270 140 220 Q 100 170 150 120 Z"
            fill={theme === 'dark' ? '#1E2A52' : '#E8F4FA'}
          />
          <path
            d="M850 180 Q 920 130 1000 180 Q 1080 140 1150 200 Q 1200 250 1160 290 Q 1090 320 990 310 Q 880 320 840 270 Q 810 220 850 180 Z"
            fill={theme === 'dark' ? '#2B4C7E' : '#D9EDF7'}
          />
        </svg>
      </div>

      {/* Subtle Twinkling Stars (Night Theme Only) */}
      <div className="hidden dark:block absolute inset-0 opacity-30">
        <div className="absolute top-[12%] left-[18%] w-1.5 h-1.5 bg-[var(--peach)] rounded-full animate-pulse" />
        <div className="absolute top-[25%] left-[65%] w-1 h-1 bg-[var(--sakura)] rounded-full animate-ping duration-1000" />
        <div className="absolute top-[40%] left-[82%] w-1.5 h-1.5 bg-[var(--mint)] rounded-full animate-pulse" />
        <div className="absolute top-[8%] left-[45%] w-1 h-1 bg-[var(--text-main)] rounded-full" />
        <div className="absolute top-[35%] left-[28%] w-1 h-1 bg-[var(--text-main)] rounded-full animate-pulse" />
      </div>

      {/* Falling Sakura Petals Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

