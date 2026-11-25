import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { type ReactNode, useEffect, useRef } from "react";

export function PageTransition({
  routeKey,
  children,
  className,
}: {
  routeKey: string;
  children: ReactNode;
  className?: string;
}) {
  const { mode } = useMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    // Reference routeKey so Biome tracks route transitions as the trigger.
    el.dataset.routeKey = routeKey;

    if (mode === "reduced") {
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "transform,opacity" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.34,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform,opacity",
        },
      );
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [routeKey, mode]);

  return (
    <div ref={containerRef} className={cn(className)}>
      {children}
    </div>
  );
}
