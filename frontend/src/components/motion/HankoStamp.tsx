import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useEffect, useRef } from "react";

type HankoSize = "sm" | "md" | "lg";

const SIZE_STYLES: Record<
  HankoSize,
  { frame: string; label: string; sublabel: string; innerInset: string }
> = {
  sm: {
    frame: "min-w-14 px-2.5 py-1.5",
    label: "text-lg leading-none",
    sublabel: "mt-0.5 text-[10px] leading-tight",
    innerInset: "inset-[2px]",
  },
  md: {
    frame: "min-w-[4.75rem] px-3.5 py-2.5",
    label: "text-2xl leading-none",
    sublabel: "mt-1 text-[11px] leading-tight",
    innerInset: "inset-[3px]",
  },
  lg: {
    frame: "min-w-[6.25rem] px-5 py-3.5",
    label: "text-3xl leading-none",
    sublabel: "mt-1 text-xs leading-tight",
    innerInset: "inset-[3px]",
  },
};

export function HankoStamp({
  label,
  sublabel,
  size = "md",
  className,
}: {
  label: string;
  sublabel?: string;
  size?: HankoSize;
  className?: string;
}) {
  const { mode } = useMotionPreference();
  const stampRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const styles = SIZE_STYLES[size];

  useEffect(() => {
    const stamp = stampRef.current;
    const ink = inkRef.current;
    if (!stamp || !ink || typeof window === "undefined") return;

    // Re-stamp when label or sublabel updates for a fresh result.
    stamp.dataset.stampValue = sublabel ? `${label}:${sublabel}` : label;

    if (mode === "reduced") {
      gsap.killTweensOf([stamp, ink]);
      gsap.set(stamp, { clearProps: "transform,opacity,visibility" });
      gsap.set(ink, { clearProps: "transform,opacity" });
      return;
    }

    const ctx = gsap.context(() => {
      // Total sequence: 0.28s impact + 0.22s settle = 0.50s (<= 650ms).
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(stamp, { clearProps: "transform,opacity,visibility" });
          gsap.set(ink, { clearProps: "transform,opacity" });
        },
      });

      tl.fromTo(
        stamp,
        { scale: 1.42, y: -12, autoAlpha: 0, rotation: -4 },
        {
          scale: 0.96,
          y: 1,
          autoAlpha: 1,
          rotation: -4,
          duration: 0.28,
          ease: "power3.in",
        },
        0,
      )
        .fromTo(
          ink,
          { opacity: 0, scale: 0.92 },
          {
            opacity: 1,
            scale: 1.04,
            duration: 0.26,
            ease: "power2.out",
          },
          0.24,
        )
        .to(
          stamp,
          {
            scale: 1,
            y: 0,
            rotation: -4,
            duration: 0.22,
            ease: "back.out(1.6)",
          },
          0.28,
        );
    }, stampRef);

    return () => {
      ctx.revert();
    };
  }, [mode, label, sublabel]);

  return (
    <div
      ref={stampRef}
      className={cn(
        "relative inline-flex shrink-0 select-none flex-col items-center justify-center rounded-[4px] border-2 border-accent bg-accent/[0.06] text-center text-accent shadow-[0_1px_2px_oklch(var(--accent)/0.12)] -rotate-[4deg]",
        styles.frame,
        className,
      )}
    >
      <span
        ref={inkRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[3px] rounded-[5px] border border-accent/25 bg-accent/[0.05]"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute rounded-[2px] border border-accent/55",
          styles.innerInset,
        )}
      />
      <span
        className={cn(
          "relative font-display font-semibold tabular-nums tracking-tight",
          styles.label,
        )}
      >
        {label}
      </span>
      {sublabel ? (
        <span
          className={cn(
            "relative border-t border-accent/35 pt-0.5 font-body font-semibold uppercase tracking-[0.08em] text-accent/90",
            styles.sublabel,
          )}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
