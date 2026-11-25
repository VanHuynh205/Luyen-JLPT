import { useMotionPreference } from "@/hooks/useMotionPreference";
import gsap from "gsap";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { type ReactNode, useEffect } from "react";

// GSAP's built-in lagSmoothing defaults restored when leaving the Home route.
const GSAP_DEFAULT_LAG_THRESHOLD = 500;
const GSAP_DEFAULT_ADJUSTED_LAG = 33;

export function HomeSmoothScroll({ children }: { children: ReactNode }) {
  const { mode } = useMotionPreference();

  useEffect(() => {
    if (mode !== "full") return;
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }

    const lenis = new Lenis({
      autoRaf: false,
      anchors: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.1,
      respectReducedMotion: false,
      stopInertiaOnNavigate: true,
    });

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      gsap.ticker.lagSmoothing(
        GSAP_DEFAULT_LAG_THRESHOLD,
        GSAP_DEFAULT_ADJUSTED_LAG,
      );
      lenis.destroy();
    };
  }, [mode]);

  return <>{children}</>;
}
