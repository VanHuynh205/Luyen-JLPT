import {
  type ResolvedTheme,
  useThemePreference,
} from "@/hooks/useThemePreference";
import { cn } from "@/lib/utils";
import type { JSX } from "react";
import { MINCHO_FONT_FAMILY, getKanjiForLevel, getSceneTokens } from "./tokens";

export interface DeskHeroFallbackProps {
  level: string;
  theme?: ResolvedTheme;
  className?: string;
}

/** Immediate 0ms static Washi & Sumi desk illustration matching the 3D scene framing. */
export function DeskHeroFallback({
  level,
  theme,
  className,
}: DeskHeroFallbackProps): JSX.Element {
  const { resolved } = useThemePreference();
  const activeTheme = theme ?? resolved;
  const isDark = activeTheme === "dark";
  const tokens = getSceneTokens(activeTheme);
  const kanji = getKanjiForLevel(level);

  const palette = isDark
    ? {
        woodTop: "#5C4634",
        woodBottom: "#3D2D20",
        bevelStart: "#36271C",
        bevelEnd: "#291D14",
        deskEdge: "#765D46",
        woodGrain: "#2A1F16",
        plaqueStart: "#2A2E39",
        plaqueEnd: "#20242E",
        plaqueEdge: "#181B23",
        plaqueStroke: "#3C4252",
        card1Fill: "#20242E",
        card1Stroke: "#333948",
        card2Fill: "#242833",
        card2Stroke: "#383E4F",
        card3Fill: "#282D39",
        card3Stroke: "#3D4457",
        card4Stroke: "#464E64",
        easelTop: "#3D2D20",
        easelBottom: "#2C2016",
        hankoStart: "#5E4634",
        hankoEnd: "#2B1E16",
        hankoBaseDark: "#A93B24",
        hankoBaseTop: "#EF6D51",
        hankoCollar: "#B89A6C",
        hankoCap: "#5B4332",
        hankoCapInner: "#6D523E",
        shadowPeak: "0.34",
        shadowMid: "0.14",
      }
    : {
        woodTop: "#9A7957",
        woodBottom: "#77593C",
        bevelStart: "#6D5136",
        bevelEnd: "#563E28",
        deskEdge: "#B4936F",
        woodGrain: "#6A4E34",
        plaqueStart: tokens.card,
        plaqueEnd: "#F3ECE1",
        plaqueEdge: "#DED4C4",
        plaqueStroke: "#D9CEBC",
        card1Fill: "#EAE3D7",
        card1Stroke: "#CFC4B4",
        card2Fill: "#F3EDE3",
        card2Stroke: "#D8CEC0",
        card3Fill: "#FAF6EF",
        card3Stroke: "#DFD6C8",
        card4Stroke: "#DFD6C8",
        easelTop: "#5B422C",
        easelBottom: "#463220",
        hankoStart: "#523C2C",
        hankoEnd: "#261B14",
        hankoBaseDark: "#A92E16",
        hankoBaseTop: "#E05033",
        hankoCollar: "#C7A97C",
        hankoCap: "#5A4331",
        hankoCapInner: "#6B513C",
        shadowPeak: "0.16",
        shadowMid: "0.06",
      };

  return (
    <div
      aria-hidden="true"
      data-scene-theme={activeTheme}
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
            <stop offset="0" stopColor={palette.woodTop} />
            <stop offset="0.55" stopColor={tokens.deskWood} />
            <stop offset="1" stopColor={palette.woodBottom} />
          </linearGradient>

          <linearGradient
            id="desk-wood-bevel"
            x1="70"
            y1="286"
            x2="570"
            y2="316"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={palette.bevelStart} />
            <stop offset="1" stopColor={palette.bevelEnd} />
          </linearGradient>

          <linearGradient
            id="plaque-surface"
            x1="330"
            y1="44"
            x2="508"
            y2="226"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={palette.plaqueStart} />
            <stop offset="1" stopColor={palette.plaqueEnd} />
          </linearGradient>

          <linearGradient
            id="hanko-body"
            x1="490"
            y1="184"
            x2="540"
            y2="254"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={palette.hankoStart} />
            <stop offset="0.5" stopColor={tokens.hankoWood} />
            <stop offset="1" stopColor={palette.hankoEnd} />
          </linearGradient>

          <radialGradient id="soft-ink-shadow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0"
              stopColor={tokens.inkShadow}
              stopOpacity={palette.shadowPeak}
            />
            <stop
              offset="0.7"
              stopColor={tokens.inkShadow}
              stopOpacity={palette.shadowMid}
            />
            <stop offset="1" stopColor={tokens.inkShadow} stopOpacity="0" />
          </radialGradient>

          {isDark && (
            <radialGradient id="desk-lamp-pool" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor={tokens.lamp} stopOpacity="0.16" />
              <stop offset="0.6" stopColor={tokens.lamp} stopOpacity="0.06" />
              <stop offset="1" stopColor={tokens.lamp} stopOpacity="0" />
            </radialGradient>
          )}
        </defs>

        {isDark && (
          <ellipse
            cx="424"
            cy="194"
            rx="210"
            ry="136"
            fill="url(#desk-lamp-pool)"
          />
        )}

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
          stroke={palette.deskEdge}
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <line
          x1="104"
          y1="214"
          x2="538"
          y2="214"
          stroke={palette.woodGrain}
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <line
          x1="88"
          y1="246"
          x2="554"
          y2="246"
          stroke={palette.woodGrain}
          strokeOpacity="0.20"
          strokeWidth="1"
        />
        <line
          x1="74"
          y1="274"
          x2="566"
          y2="274"
          stroke={palette.woodGrain}
          strokeOpacity="0.18"
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
              fill={palette.card1Fill}
              stroke={palette.card1Stroke}
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
              fill={palette.card2Fill}
              stroke={palette.card2Stroke}
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
              fill={palette.card3Fill}
              stroke={palette.card3Stroke}
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
              fill={tokens.card}
              stroke={palette.card4Stroke}
              strokeWidth="1"
            />
            {/* Indigo header and note lines */}
            <line
              x1="28"
              y1="26"
              x2="170"
              y2="26"
              stroke={tokens.primary}
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
            <rect
              x="28"
              y="12"
              width="58"
              height="6"
              rx="2"
              fill={tokens.foreground}
              fillOpacity="0.55"
            />
            <line
              x1="28"
              y1="44"
              x2="170"
              y2="44"
              stroke={tokens.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="35"
              width="90"
              height="4"
              rx="2"
              fill={tokens.foreground}
              fillOpacity="0.22"
            />
            <line
              x1="28"
              y1="62"
              x2="170"
              y2="62"
              stroke={tokens.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="53"
              width="76"
              height="4"
              rx="2"
              fill={tokens.foreground}
              fillOpacity="0.22"
            />
            <line
              x1="28"
              y1="80"
              x2="132"
              y2="80"
              stroke={tokens.primary}
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="71"
              width="62"
              height="4"
              rx="2"
              fill={tokens.foreground}
              fillOpacity="0.2"
            />
            {/* Small vermilion stamp impression */}
            <g transform="translate(154, 74) rotate(-4)">
              <circle
                cx="0"
                cy="0"
                r="10"
                stroke={tokens.accent}
                strokeWidth="1.6"
                strokeOpacity="0.88"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill={tokens.accent}
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
        <path
          d="M342 224 L496 224 L506 240 L332 240 Z"
          fill={palette.easelTop}
        />
        <rect
          x="332"
          y="236"
          width="174"
          height="6"
          rx="2"
          fill={palette.easelBottom}
        />

        {/* Elevated Kanji display plaque (center-right) */}
        <g transform="translate(342, 48)">
          {/* Plaque side thickness */}
          <rect
            x="6"
            y="4"
            width="156"
            height="174"
            rx="8"
            fill={palette.plaqueEdge}
          />
          {/* Plaque front washi face */}
          <rect
            x="0"
            y="0"
            width="156"
            height="174"
            rx="8"
            fill="url(#plaque-surface)"
            stroke={palette.plaqueStroke}
            strokeWidth="1.2"
          />
          {/* Double indigo frame */}
          <rect
            x="11"
            y="11"
            width="134"
            height="152"
            rx="4"
            stroke={tokens.primary}
            strokeOpacity="0.34"
            strokeWidth="1.2"
          />
          <rect
            x="16"
            y="16"
            width="124"
            height="142"
            rx="2.5"
            stroke={tokens.primary}
            strokeOpacity="0.14"
            strokeWidth="1"
          />
          {/* Subtle relief shadow behind glyph */}
          <text
            x="80"
            y="118"
            textAnchor="middle"
            fill={tokens.foreground}
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
            fill={tokens.foreground}
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
          <ellipse
            cx="22"
            cy="74"
            rx="19"
            ry="7"
            fill={palette.hankoBaseDark}
          />
          <rect x="3" y="64" width="38" height="10" fill={tokens.accent} />
          <ellipse
            cx="22"
            cy="64"
            rx="19"
            ry="6.5"
            fill={palette.hankoBaseTop}
          />
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
            fill={palette.hankoCollar}
            fillOpacity="0.72"
          />
          {/* Top cap ellipse */}
          <ellipse cx="22" cy="10" rx="17" ry="5.5" fill={palette.hankoCap} />
          <ellipse
            cx="22"
            cy="10"
            rx="12"
            ry="3.5"
            fill={palette.hankoCapInner}
            fillOpacity="0.7"
          />
        </g>
      </svg>
    </div>
  );
}
