import React from 'react';

export type MascotMood = 'idle' | 'reading' | 'celebrating' | 'thinking' | 'sleepy';

interface MascotProps {
  mood?: MascotMood;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Mascot: React.FC<MascotProps> = ({
  mood = 'idle',
  size = 'md',
  className = ''
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-28 h-28',
    xl: 'w-40 h-40'
  };

  return (
    <div className={`inline-block select-none ${sizeMap[size]} ${className}`}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform hover:scale-105 duration-200"
      >
        {/* Soft Aura / Glow Circle */}
        <circle cx="60" cy="65" r="46" fill="var(--peach)" fillOpacity="0.25" />

        {/* Tail */}
        <path
          d="M78 82C92 84 105 76 106 60C107 48 98 42 90 46C92 56 86 68 76 72"
          fill="#FFB48A"
          stroke="var(--ink-border)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Tail White Tip */}
        <path
          d="M96 50C103 48 106 54 106 60C104 68 98 74 90 77C92 68 95 58 96 50Z"
          fill="#FFF7EA"
          stroke="var(--ink-border)"
          strokeWidth="2.5"
        />

        {/* Body */}
        <ellipse
          cx="60"
          cy="75"
          rx="26"
          ry="24"
          fill="#FFB48A"
          stroke="var(--ink-border)"
          strokeWidth="3.5"
        />
        {/* White Chest Apron */}
        <path
          d="M48 68C48 78 54 88 60 88C66 88 72 78 72 68C68 64 52 64 48 68Z"
          fill="#FFF7EA"
        />

        {/* Ears */}
        {/* Left Ear */}
        <path
          d="M36 46L24 20C32 20 46 28 48 36L36 46Z"
          fill="#FFB48A"
          stroke="var(--ink-border)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M34 40L28 25C32 25 40 30 42 34Z" fill="#FF8FB1" />

        {/* Right Ear */}
        <path
          d="M84 46L96 20C88 20 74 28 72 36L84 46Z"
          fill="#FFB48A"
          stroke="var(--ink-border)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M86 40L92 25C88 25 80 30 78 34Z" fill="#FF8FB1" />

        {/* Head */}
        <ellipse
          cx="60"
          cy="48"
          rx="28"
          ry="22"
          fill="#FFB48A"
          stroke="var(--ink-border)"
          strokeWidth="3.5"
        />

        {/* White Cheeks */}
        <path
          d="M34 50C34 58 42 64 48 64C54 64 58 60 60 58C62 60 66 64 72 64C78 64 86 58 86 50C86 42 80 40 76 42C68 44 64 46 60 46C56 46 52 44 44 42C40 40 34 42 34 50Z"
          fill="#FFF7EA"
        />

        {/* Eyes & Expressions according to mood */}
        {mood === 'idle' && (
          <>
            {/* Happy anime closed eyes */}
            <path
              d="M46 46C48 43 52 43 54 46"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M66 46C68 43 72 43 74 46"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}

        {mood === 'reading' && (
          <>
            {/* Round Glasses */}
            <circle
              cx="49"
              cy="46"
              r="7"
              stroke="var(--ink)"
              strokeWidth="2.5"
              fill="rgba(191, 227, 245, 0.4)"
            />
            <circle
              cx="71"
              cy="46"
              r="7"
              stroke="var(--ink)"
              strokeWidth="2.5"
              fill="rgba(191, 227, 245, 0.4)"
            />
            <line x1="56" y1="46" x2="64" y2="46" stroke="var(--ink)" strokeWidth="2.5" />
            <circle cx="49" cy="46" r="2.5" fill="var(--ink)" />
            <circle cx="71" cy="46" r="2.5" fill="var(--ink)" />
          </>
        )}

        {mood === 'celebrating' && (
          <>
            {/* Starry eyes */}
            <path
              d="M48 42L50 45L53 45L51 47L52 50L49 48L46 50L47 47L45 45L48 45Z"
              fill="#FF8FB1"
              stroke="var(--ink)"
              strokeWidth="1.5"
            />
            <path
              d="M70 42L72 45L75 45L73 47L74 50L71 48L68 50L69 47L67 45L70 45Z"
              fill="#FF8FB1"
              stroke="var(--ink)"
              strokeWidth="1.5"
            />
            {/* Open mouth */}
            <path d="M56 54Q60 60 64 54Z" fill="#FF8FB1" stroke="var(--ink)" strokeWidth="2" />
          </>
        )}

        {mood === 'thinking' && (
          <>
            <circle cx="48" cy="46" r="3" fill="var(--ink)" />
            <path
              d="M66 45C68 47 72 47 74 45"
              stroke="var(--ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Question Mark floating */}
            <text
              x="78"
              y="28"
              fill="var(--sakura)"
              stroke="var(--ink-border)"
              strokeWidth="1.5"
              fontSize="20"
              fontWeight="900"
              fontFamily="system-ui"
            >
              ?
            </text>
          </>
        )}

        {mood === 'sleepy' && (
          <>
            {/* Sleeping lines */}
            <path d="M46 48L54 48" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <path d="M66 48L74 48" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <text
              x="82"
              y="32"
              fill="var(--sakura)"
              fontSize="14"
              fontWeight="bold"
              fontFamily="'DotGothic16', monospace"
            >
              zZ
            </text>
          </>
        )}

        {/* Nose */}
        <polygon points="58,51 62,51 60,53" fill="var(--ink)" />

        {/* Blush Cheeks */}
        <circle cx="40" cy="52" r="3.5" fill="#FF8FB1" fillOpacity="0.7" />
        <circle cx="80" cy="52" r="3.5" fill="#FF8FB1" fillOpacity="0.7" />

        {/* Paws */}
        <ellipse cx="48" cy="85" rx="5" ry="4" fill="#FFF7EA" stroke="var(--ink-border)" strokeWidth="2.5" />
        <ellipse cx="72" cy="85" rx="5" ry="4" fill="#FFF7EA" stroke="var(--ink-border)" strokeWidth="2.5" />

        {/* Mini Book or Scroll when reading */}
        {mood === 'reading' && (
          <path
            d="M48 80L60 76L72 80L72 90L60 86L48 90Z"
            fill="var(--mint)"
            stroke="var(--ink-border)"
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

