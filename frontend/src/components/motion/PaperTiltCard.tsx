import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { type ReactNode, useEffect, useRef } from "react";

const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const MAX_SHEEN_OPACITY = 0.07;

export function PaperTiltCard({
  children,
  className,
  maxTiltDeg = 3,
}: {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
}) {
  const { mode } = useMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const surface = surfaceRef.current;
    const sheen = sheenRef.current;
    if (!container || !surface || !sheen || typeof window === "undefined") {
      return;
    }

    const resetVisuals = () => {
      gsap.killTweensOf([surface, sheen]);
      gsap.set(surface, { clearProps: "transform,willChange" });
      gsap.set(sheen, { opacity: 0 });
    };

    if (mode !== "full" || typeof window.matchMedia !== "function") {
      resetVisuals();
      return;
    }

    const hoverMql = window.matchMedia(FINE_HOVER_QUERY);
    const limit = Math.max(0, maxTiltDeg);

    let detachListeners: (() => void) | null = null;

    const attach = () => {
      if (detachListeners) return;

      const rotateXTo = gsap.quickTo(surface, "rotationX", {
        duration: 0.34,
        ease: "power2.out",
      });
      const rotateYTo = gsap.quickTo(surface, "rotationY", {
        duration: 0.34,
        ease: "power2.out",
      });
      const sheenOpacityTo = gsap.quickTo(sheen, "opacity", {
        duration: 0.26,
        ease: "power2.out",
      });

      const onPointerEnter = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
          return;
        }
        surface.style.willChange = "transform";
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
          return;
        }
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const nx = Math.max(
          -1,
          Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2),
        );
        const ny = Math.max(
          -1,
          Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2),
        );

        rotateXTo(-ny * limit);
        rotateYTo(nx * limit);
        sheen.style.setProperty(
          "--paper-sheen-x",
          `${((nx + 1) * 50).toFixed(1)}%`,
        );
        sheen.style.setProperty(
          "--paper-sheen-y",
          `${((ny + 1) * 50).toFixed(1)}%`,
        );
        sheenOpacityTo(MAX_SHEEN_OPACITY);
      };

      const onPointerLeave = () => {
        rotateXTo(0);
        rotateYTo(0);
        sheenOpacityTo(0);
        surface.style.willChange = "";
      };

      container.addEventListener("pointerenter", onPointerEnter);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);

      detachListeners = () => {
        container.removeEventListener("pointerenter", onPointerEnter);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerleave", onPointerLeave);
        detachListeners = null;
        resetVisuals();
      };
    };

    const syncCapability = () => {
      if (hoverMql.matches && limit > 0) {
        attach();
      } else {
        detachListeners?.();
        resetVisuals();
      }
    };

    syncCapability();

    hoverMql.addEventListener?.("change", syncCapability);

    return () => {
      hoverMql.removeEventListener?.("change", syncCapability);
      detachListeners?.();
      resetVisuals();
    };
  }, [mode, maxTiltDeg]);

  return (
    <div
      ref={containerRef}
      className={cn("relative [perspective:900px]", className)}
    >
      <div
        ref={surfaceRef}
        className="relative h-full w-full rounded-[inherit] [transform-style:preserve-3d]"
      >
        {children}
        <span
          ref={sheenRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0"
          style={{
            background:
              "radial-gradient(circle at var(--paper-sheen-x, 50%) var(--paper-sheen-y, 50%), rgba(254, 253, 251, 0.9) 0%, rgba(254, 253, 251, 0) 68%)",
          }}
        />
      </div>
    </div>
  );
}
