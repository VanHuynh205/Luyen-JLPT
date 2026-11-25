import { cn } from "@/lib/utils";
import type { JSX } from "react";
import { MINCHO_FONT_FAMILY, SCENE_TOKENS, getKanjiForLevel } from "./tokens";

export interface DeskHeroFallbackProps {
  level: string;
  className?: string;
}

/** Immediate 0ms static Washi & Sumi desk illustration matching the 3D scene framing. */
export function DeskHeroFallback({
  level,
  className,
}: DeskHeroFallbackProps): JSX.Element {
  const kanji = getKanjiForLevel(level);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-full w-full select-none overflow-hidden",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 640 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient
            id="desk-wood-surface"
            x1="96"
            y1="176"
            x2="544"
            y2="322"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#9A7957" />
            <stop offset="0.55" stopColor={SCENE_TOKENS.deskWood} />
            <stop offset="1" stopColor="#77593C" />
          </linearGradient>

          <linearGradient
            id="desk-wood-bevel"
            x1="70"
            y1="286"
            x2="570"
            y2="316"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#6D5136" />
            <stop offset="1" stopColor="#563E28" />
          </linearGradient>

          <linearGradient
            id="plaque-surface"
            x1="330"
            y1="44"
            x2="508"
            y2="226"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={SCENE_TOKENS.card} />
            <stop offset="1" stopColor="#F3ECE1" />
          </linearGradient>

          <linearGradient
            id="hanko-body"
            x1="490"
            y1="184"
            x2="540"
            y2="254"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#523C2C" />
            <stop offset="0.5" stopColor={SCENE_TOKENS.hankoWood} />
            <stop offset="1" stopColor="#261B14" />
          </linearGradient>

          <radialGradient id="soft-ink-shadow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0"
              stopColor={SCENE_TOKENS.inkShadow}
              stopOpacity="0.16"
            />
            <stop
              offset="0.7"
              stopColor={SCENE_TOKENS.inkShadow}
              stopOpacity="0.06"
            />
            <stop
              offset="1"
              stopColor={SCENE_TOKENS.inkShadow}
              stopOpacity="0"
            />
          </radialGradient>
        </defs>

        {/* Ground shadow beneath the wooden desk */}
        <ellipse
          cx="320"
          cy="322"
          rx="258"
          ry="22"
          fill="url(#soft-ink-shadow)"
        />

        {/* Wooden desk plane (perspective trapezoid with front bevel) */}
        <path
          d="M114 186 L526 186 L578 292 L62 292 Z"
          fill="url(#desk-wood-surface)"
        />
        <path
          d="M62 292 L578 292 L572 308 L68 308 Z"
          fill="url(#desk-wood-bevel)"
        />
        {/* Crisp top-edge highlight and subtle wood grain lines */}
        <line
          x1="116"
          y1="187"
          x2="524"
          y2="187"
          stroke="#B4936F"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <line
          x1="104"
          y1="214"
          x2="538"
          y2="214"
          stroke="#6A4E34"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="88"
          y1="246"
          x2="554"
          y2="246"
          stroke="#6A4E34"
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        <line
          x1="74"
          y1="274"
          x2="566"
          y2="274"
          stroke="#6A4E34"
          strokeOpacity="0.15"
          strokeWidth="1"
        />

        {/* Soft ink shadows cast onto the desk */}
        <ellipse
          cx="222"
          cy="252"
          rx="108"
          ry="28"
          fill="url(#soft-ink-shadow)"
        />
        <ellipse
          cx="424"
          cy="236"
          rx="96"
          ry="24"
          fill="url(#soft-ink-shadow)"
        />
        <ellipse
          cx="526"
          cy="258"
          rx="34"
          ry="12"
          fill="url(#soft-ink-shadow)"
        />

        {/* Stack of Washi flashcards (left-front) */}
        <g transform="translate(120, 178)">
          {/* Card 1 (bottom) */}
          <g transform="rotate(-4.5 92 48)">
            <rect
              x="6"
              y="18"
              width="174"
              height="96"
              rx="6"
              fill="#EAE3D7"
              stroke="#CFC4B4"
              strokeWidth="1"
            />
          </g>
          {/* Card 2 */}
          <g transform="rotate(2.8 92 46)">
            <rect
              x="8"
              y="12"
              width="174"
              height="96"
              rx="6"
              fill="#F3EDE3"
              stroke="#D8CEC0"
              strokeWidth="1"
            />
          </g>
          {/* Card 3 */}
          <g transform="rotate(-1.8 92 44)">
            <rect
              x="10"
              y="6"
              width="174"
              height="96"
              rx="6"
              fill="#FAF6EF"
              stroke="#DFD6C8"
              strokeWidth="1"
            />
          </g>
          {/* Card 4 (top card with indigo rulings + corner vermilion seal mark) */}
          <g transform="rotate(1.4 92 42)">
            <rect
              x="12"
              y="0"
              width="174"
              height="96"
              rx="6"
              fill={SCENE_TOKENS.card}
              stroke="#DFD6C8"
              strokeWidth="1"
            />
            {/* Indigo header and note lines */}
            <line
              x1="28"
              y1="26"
              x2="170"
              y2="26"
              stroke={SCENE_TOKENS.primary}
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
            <rect
              x="28"
              y="12"
              width="58"
              height="6"
              rx="2"
              fill={SCENE_TOKENS.foreground}
              fillOpacity="0.55"
            />
            <line
              x1="28"
              y1="44"
              x2="170"
              y2="44"
              stroke={SCENE_TOKENS.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="35"
              width="90"
              height="4"
              rx="2"
              fill={SCENE_TOKENS.foreground}
              fillOpacity="0.22"
            />
            <line
              x1="28"
              y1="62"
              x2="170"
              y2="62"
              stroke={SCENE_TOKENS.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="53"
              width="76"
              height="4"
              rx="2"
              fill={SCENE_TOKENS.foreground}
              fillOpacity="0.22"
            />
            <line
              x1="28"
              y1="80"
              x2="132"
              y2="80"
              stroke={SCENE_TOKENS.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="71"
              width="62"
              height="4"
              rx="2"
              fill={SCENE_TOKENS.foreground}
              fillOpacity="0.2"
            />
            {/* Small vermilion stamp impression */}
            <g transform="translate(154, 74) rotate(-4)">
              <circle
                cx="0"
                cy="0"
                r="10"
                stroke={SCENE_TOKENS.accent}
                strokeWidth="1.6"
                strokeOpacity="0.88"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill={SCENE_TOKENS.accent}
                fillOpacity="0.88"
                fontSize="10"
                fontWeight="700"
                fontFamily={MINCHO_FONT_FAMILY}
              >
                済
              </text>
            </g>
          </g>
        </g>

        {/* Wooden easel base for the Kanji plaque */}
        <path d="M342 224 L496 224 L506 240 L332 240 Z" fill="#5B422C" />
        <rect x="332" y="236" width="174" height="6" rx="2" fill="#463220" />

        {/* Elevated Kanji display plaque (center-right) */}
        <g transform="translate(342, 48)">
          {/* Plaque side thickness */}
          <rect x="6" y="4" width="156" height="174" rx="8" fill="#DED4C4" />
          {/* Plaque front washi face */}
          <rect
            x="0"
            y="0"
            width="156"
            height="174"
            rx="8"
            fill="url(#plaque-surface)"
            stroke="#D9CEBC"
            strokeWidth="1.2"
          />
          {/* Double indigo frame */}
          <rect
            x="11"
            y="11"
            width="134"
            height="152"
            rx="4"
            stroke={SCENE_TOKENS.primary}
            strokeOpacity="0.34"
            strokeWidth="1.2"
          />
          <rect
            x="16"
            y="16"
            width="124"
            height="142"
            rx="2.5"
            stroke={SCENE_TOKENS.primary}
            strokeOpacity="0.14"
            strokeWidth="1"
          />
          {/* Subtle relief shadow behind glyph */}
          <text
            x="80"
            y="118"
            textAnchor="middle"
            fill={SCENE_TOKENS.foreground}
            fillOpacity="0.10"
            fontSize="94"
            fontWeight="600"
            fontFamily={MINCHO_FONT_FAMILY}
          >
            {kanji}
          </text>
          {/* Main Mincho Kanji */}
          <text
            x="78"
            y="116"
            textAnchor="middle"
            fill={SCENE_TOKENS.foreground}
            fontSize="94"
            fontWeight="600"
            fontFamily={MINCHO_FONT_FAMILY}
          >
            {kanji}
          </text>
        </g>

        {/* Cylindrical dark-wood Hanko stamp with vermilion base */}
        <g transform="translate(502, 180)">
          {/* Vermilion base pad */}
          <ellipse cx="22" cy="74" rx="19" ry="7" fill="#A92E16" />
          <rect
            x="3"
            y="64"
            width="38"
            height="10"
            fill={SCENE_TOKENS.accent}
          />
          <ellipse cx="22" cy="64" rx="19" ry="6.5" fill="#E05033" />
          {/* Dark wood shaft */}
          <rect
            x="5"
            y="10"
            width="34"
            height="54"
            rx="3"
            fill="url(#hanko-body)"
          />
          {/* Subtle brass/wood collar ring */}
          <rect
            x="5"
            y="59"
            width="34"
            height="4"
            fill="#C7A97C"
            fillOpacity="0.72"
          />
          {/* Top cap ellipse */}
          <ellipse cx="22" cy="10" rx="17" ry="5.5" fill="#5A4331" />
          <ellipse
            cx="22"
            cy="10"
            rx="12"
            ry="3.5"
            fill="#6B513C"
            fillOpacity="0.7"
          />
        </g>
      </svg>
    </div>
  );
}
