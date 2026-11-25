import {
  checkMotionWebGL,
  useMotionPreference,
} from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import {
  type JSX,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
} from "react";
import { DeskHeroFallback } from "./DeskHeroFallback";
import { ErrorBoundary3D } from "./ErrorBoundary3D";

const LazyDeskHeroCanvas = lazy(() => import("./DeskHeroCanvas"));

export interface DeskHeroStageProps {
  level: string;
  className?: string;
}

export function DeskHeroStage({
  level,
  className,
}: DeskHeroStageProps): JSX.Element {
  const { mode, markLowPerf, webglSupported } = useMotionPreference();
  const [canvasReady, setCanvasReady] = useState(false);
  const [fallenBack, setFallenBack] = useState(false);

  useEffect(() => {
    if (mode === "full") checkMotionWebGL();
  }, [mode]);

  const shouldRender3D =
    mode === "full" && webglSupported === true && !fallenBack;

  useEffect(() => {
    if (!shouldRender3D) {
      setCanvasReady(false);
    }
  }, [shouldRender3D]);

  const handleReady = useCallback(() => {
    setCanvasReady(true);
  }, []);

  const handleDegradeToFallback = useCallback(() => {
    setCanvasReady(false);
    setFallenBack(true);
    markLowPerf();
  }, [markLowPerf]);

  return (
    <div
      aria-hidden="true"
      className={cn("relative aspect-[16/9] w-full overflow-hidden", className)}
    >
      <div
        className={cn(
          "absolute inset-0",
          canvasReady && shouldRender3D
            ? "opacity-0 transition-opacity duration-500 ease-out"
            : "opacity-100",
        )}
      >
        <DeskHeroFallback level={level} />
      </div>

      {shouldRender3D && (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 ease-out",
            canvasReady ? "opacity-100" : "opacity-0",
          )}
        >
          <ErrorBoundary3D fallback={null} onError={handleDegradeToFallback}>
            <Suspense fallback={null}>
              <LazyDeskHeroCanvas
                level={level}
                onReady={handleReady}
                onLowPerf={handleDegradeToFallback}
                onContextLost={handleDegradeToFallback}
              />
            </Suspense>
          </ErrorBoundary3D>
        </div>
      )}
    </div>
  );
}
