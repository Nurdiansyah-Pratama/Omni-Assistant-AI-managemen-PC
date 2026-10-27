import { memo } from "react";
import type { AssistantTheme } from "../../types/assistantTheme";

const robotThemeClassById: Record<string, string> = {
  blue: "omni-robot-theme-blue",
  yellow: "omni-robot-theme-yellow",
  violet: "omni-robot-theme-violet",
  red: "omni-robot-theme-red",
  green: "omni-robot-theme-green",
};

interface OmniRobotProps {
  theme: AssistantTheme;
  className?: string;
  animated?: boolean;
  activity?: "idle" | "thinking";
}

function OmniRobotComponent({
  theme,
  className = "",
  animated = false,
  activity = "idle",
}: OmniRobotProps) {
  const themeClass =
    robotThemeClassById[theme.id] ?? "omni-robot-theme-blue";
  const animationClass = animated
    ? `omni-robot-animated omni-robot-${activity}`
    : "";

  return (
    <svg
      viewBox="0 0 180 250"
      role="img"
      aria-label={`Omni dengan warna ${theme.label}`}
      shapeRendering="geometricPrecision"
      className={`${themeClass} ${animationClass} ${className}`.trim()}
    >
      <defs>
        <linearGradient id="omni-armor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="25%" stopColor="#334155" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="omni-armor-specular" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#334155" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="omni-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="35%" stopColor="var(--robot-glow)" />
          <stop offset="100%" stopColor="var(--robot-accent)" />
        </linearGradient>
        <linearGradient id="omni-visor-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#040d1a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <filter
          id="omni-glow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dynamic Floating Shadow */}
      <ellipse
        className="omni-robot-shadow"
        cx="90"
        cy="239"
        rx="55"
        ry="8"
        fill="#020617"
      />

      {/* Head Group */}
      <g className="omni-robot-head">
        {/* Antennas */}
        <g className="omni-robot-antenna-left">
          <path
            d="M43 56 34 19l9-7 8 48Z"
            fill="#111827"
            stroke="#020617"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <circle cx="38" cy="16" r="3.5" fill="var(--robot-glow)" filter="url(#omni-glow)" />
        </g>
        <g className="omni-robot-antenna-right">
          <path
            d="m137 56 9-37-9-7-8 48Z"
            fill="#111827"
            stroke="#020617"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <circle cx="142" cy="16" r="3.5" fill="var(--robot-glow)" filter="url(#omni-glow)" />
        </g>

        {/* Head Shell */}
        <rect
          x="35"
          y="45"
          width="110"
          height="82"
          rx="39"
          fill="url(#omni-armor)"
          stroke="#020617"
          strokeWidth="6"
        />
        {/* Specular Highlight on Head */}
        <path
          d="M50 49c12-5 68-5 80 0"
          stroke="url(#omni-armor-specular)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M48 54c13-24 71-29 86 0l-10 7H58Z"
          fill="#334155"
          stroke="#0f172a"
          strokeWidth="4"
        />

        {/* Visor Frame */}
        <path
          d="M60 63h60c9 0 16 8 14 17l-5 25c-1 8-9 14-17 14H68c-8 0-16-6-17-14l-5-25c-2-9 5-17 14-17Z"
          fill="url(#omni-visor-bg)"
          stroke="var(--robot-accent)"
          strokeWidth="5"
        />

        {/* Visor Scanner Beam (Active during thinking) */}
        <g className="omni-robot-scanner-beam">
          <line
            x1="52"
            y1="88"
            x2="128"
            y2="88"
            stroke="var(--robot-glow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#omni-glow)"
            opacity="0"
          />
        </g>

        {/* Eyes / Ocular Sensors */}
        <g className="omni-robot-eyes">
          <g className="omni-robot-eye-left">
            <path
              d="M58 82c12-11 25-10 32 1-8 18-23 20-34 8Z"
              fill="url(#omni-visor)"
              filter="url(#omni-glow)"
            />
            {/* Pupil Glint */}
            <circle
              className="omni-robot-pupil-left"
              cx="74"
              cy="86"
              r="2.5"
              fill="#ffffff"
            />
          </g>
          <g className="omni-robot-eye-right">
            <path
              d="M122 82c-12-11-25-10-32 1 8 18 23 20 34 8Z"
              fill="url(#omni-visor)"
              filter="url(#omni-glow)"
            />
            {/* Pupil Glint */}
            <circle
              className="omni-robot-pupil-right"
              cx="106"
              cy="86"
              r="2.5"
              fill="#ffffff"
            />
          </g>
        </g>

        {/* Forehead Light */}
        <path
          className="omni-robot-forehead"
          d="M76 51h28l-4 8H80Z"
          fill="var(--robot-glow)"
          filter="url(#omni-glow)"
        />

        {/* Ear Ornaments */}
        <path d="m47 59 9 3-5 42-12-6Z" fill="var(--robot-accent)" />
        <path d="m133 59-9 3 5 42 12-6Z" fill="var(--robot-accent)" />
      </g>

      {/* Torso / Body Group */}
      <g className="omni-robot-body">
        <path
          d="M61 119h58l20 30-11 55H52l-11-55Z"
          fill="url(#omni-armor)"
          stroke="#020617"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="m66 125 24 16 24-16 9 31-33 23-33-23Z"
          fill="#1e293b"
          stroke="#020617"
          strokeWidth="4"
        />

        {/* Arc Reactor Outer Ring */}
        <circle
          cx="90"
          cy="151"
          r="15"
          fill="#020617"
          stroke="var(--robot-accent)"
          strokeWidth="5"
        />
        {/* Arc Reactor Aura Ring */}
        <circle
          className="omni-robot-core-aura"
          cx="90"
          cy="151"
          r="11"
          fill="none"
          stroke="var(--robot-glow)"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          opacity="0.8"
        />
        {/* Arc Reactor Core Center */}
        <circle
          className="omni-robot-core"
          cx="90"
          cy="151"
          r="7"
          fill="var(--robot-glow)"
          filter="url(#omni-glow)"
        />

        {/* Lower Chest Panel */}
        <path
          d="M65 169h50l-7 29H72Z"
          fill="#0f172a"
          stroke="#334155"
          strokeWidth="3"
        />
        {/* Chest LED Equalizer Bar */}
        <g className="omni-robot-chest-lights">
          <line x1="77" y1="174" x2="103" y2="174" stroke="var(--robot-accent)" strokeWidth="4" strokeLinecap="round" />
          <line x1="75" y1="183" x2="105" y2="183" stroke="var(--robot-accent)" strokeWidth="4" strokeLinecap="round" />
          <line x1="73" y1="192" x2="107" y2="192" stroke="var(--robot-accent)" strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>

      {/* Left Arm with Articulated Hand */}
      <g className="omni-arm-left">
        <g className="omni-arm-left-upper">
          <path
            d="m44 133-20 15-9 47 21 7 17-44Z"
            fill="url(#omni-armor)"
            stroke="#020617"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path d="m27 151 18-8 5 17-22 12Z" fill="var(--robot-accent)" />
        </g>
        <g className="omni-hand-left">
          <circle
            cx="25"
            cy="202"
            r="13"
            fill="#1e293b"
            stroke="#020617"
            strokeWidth="5"
          />
          <circle
            cx="25"
            cy="202"
            r="4.5"
            fill="var(--robot-glow)"
            opacity="0.85"
            filter="url(#omni-glow)"
          />
        </g>
      </g>

      {/* Right Arm with Articulated Hand */}
      <g className="omni-arm-right">
        <g className="omni-arm-right-upper">
          <path
            d="m136 133 20 15 9 47-21 7-17-44Z"
            fill="url(#omni-armor)"
            stroke="#020617"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path d="m153 151-18-8-5 17 22 12Z" fill="var(--robot-accent)" />
        </g>
        <g className="omni-hand-right">
          <circle
            cx="155"
            cy="202"
            r="13"
            fill="#1e293b"
            stroke="#020617"
            strokeWidth="5"
          />
          <circle
            cx="155"
            cy="202"
            r="4.5"
            fill="var(--robot-glow)"
            opacity="0.85"
            filter="url(#omni-glow)"
          />
        </g>
      </g>

      {/* Left Leg */}
      <g className="omni-leg-left">
        <path
          d="M61 195h27l-5 39-29 3-5-16Z"
          fill="url(#omni-armor)"
          stroke="#020617"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="m58 207 25-3-2 17-27 2Z" fill="var(--robot-accent)" />
        <g className="omni-foot-left">
          <path
            d="M54 226h30l5 13H45Z"
            fill="#111827"
            stroke="#020617"
            strokeWidth="5"
            strokeLinejoin="round"
          />
        </g>
      </g>

      {/* Right Leg */}
      <g className="omni-leg-right">
        <path
          d="M119 195H92l5 39 29 3 5-16Z"
          fill="url(#omni-armor)"
          stroke="#020617"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="m122 207-25-3 2 17 27 2Z" fill="var(--robot-accent)" />
        <g className="omni-foot-right">
          <path
            d="M126 226H96l-5 13h44Z"
            fill="#111827"
            stroke="#020617"
            strokeWidth="5"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

export const OmniRobot = memo(OmniRobotComponent);
