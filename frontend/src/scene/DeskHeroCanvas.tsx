import {
  type ResolvedTheme,
  useThemePreference,
} from "@/hooks/useThemePreference";
import {
  type ReconcilerRoot,
  createRoot,
  extend,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ErrorBoundary3D } from "./ErrorBoundary3D";
import {
  createContactShadowTexture,
  createKanjiTextures,
  createWashiTexture,
  createWoodTexture,
} from "./kanjiTexture";
import { SCENE_TOKENS, getKanjiForLevel, getSceneTokens } from "./tokens";

export interface DeskHeroCanvasProps {
  level: string;
  theme?: ResolvedTheme;
  onReady: () => void;
  onLowPerf: () => void;
  onContextLost: () => void;
}

const BASE_CAMERA_POS = new THREE.Vector3(0, 2.7, 5.2);
const LOOK_AT_TARGET = new THREE.Vector3(0, 0.25, 0);
const MAX_YAW_RAD = THREE.MathUtils.degToRad(3.4);
const MAX_PITCH_RAD = THREE.MathUtils.degToRad(2.0);
const CAMERA_RADIUS = BASE_CAMERA_POS.distanceTo(LOOK_AT_TARGET);
const BASE_ELEVATION = Math.asin(
  (BASE_CAMERA_POS.y - LOOK_AT_TARGET.y) / CAMERA_RADIUS,
);

const CARD_STACK = [
  { x: -0.04, z: 0.03, rotY: -0.11 },
  { x: 0.02, z: -0.02, rotY: 0.06 },
  { x: -0.015, z: 0.01, rotY: -0.04 },
  { x: 0.01, z: -0.008, rotY: 0.03 },
  { x: 0, z: 0, rotY: -0.02 },
] as const;

function createRoundedRectGeometry(
  width: number,
  depth: number,
  height: number,
  radius: number,
  bevel: number,
): THREE.ExtrudeGeometry {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel * 0.85,
  });
  geom.rotateX(-Math.PI / 2);
  // Align top beveled surface to y = 0 so desk props rest flush.
  geom.translate(0, -(height + bevel * 0.85), 0);
  geom.computeVertexNormals();
  return geom;
}

interface DeskSceneProps {
  kanji: string;
  theme: ResolvedTheme;
  onReady: () => void;
  onLowPerf: () => void;
}

function DeskScene({
  kanji,
  theme,
  onReady,
  onLowPerf,
}: DeskSceneProps): JSX.Element {
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const plaqueGroupRef = useRef<THREE.Group>(null);

  const readyNotifiedRef = useRef(false);
  const targetParallaxRef = useRef({ x: 0, y: 0 });
  const currentParallaxRef = useRef({ x: 0, y: 0 });
  const plaqueTurnRef = useRef(0);
  const prevKanjiRef = useRef(kanji);

  // Lightweight FPS monitor state (~25 lines inside useFrame, no drei dependency).
  const fpsWindowRef = useRef({ elapsed: 0, frames: 0 });
  const expectingNextFrameRef = useRef(false);
  const reportedLowPerfRef = useRef(false);
  const dprDegradedRef = useRef(false);
  const onscreenRef = useRef(true);

  // Shared procedural geometries (explicitly disposed on unmount).
  const geometries = useMemo(() => {
    const desk = createRoundedRectGeometry(4.9, 2.75, 0.14, 0.09, 0.03);
    const deskShadowPlane = new THREE.PlaneGeometry(4.82, 2.68);
    const contactQuad = new THREE.PlaneGeometry(1, 1);
    const card = new THREE.BoxGeometry(1.56, 0.024, 0.98);
    const easelBase = new THREE.BoxGeometry(1.48, 0.11, 0.44);
    const easelBack = new THREE.BoxGeometry(1.22, 0.86, 0.07);
    const plaque = new THREE.BoxGeometry(1.36, 1.5, 0.085);
    const hankoBase = new THREE.CylinderGeometry(0.165, 0.172, 0.11, 28);
    const hankoCollar = new THREE.CylinderGeometry(0.162, 0.165, 0.032, 28);
    const hankoShaft = new THREE.CylinderGeometry(0.142, 0.162, 0.62, 28);
    const hankoCap = new THREE.SphereGeometry(
      0.142,
      24,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );

    return {
      desk,
      deskShadowPlane,
      contactQuad,
      card,
      easelBase,
      easelBack,
      plaque,
      hankoBase,
      hankoCollar,
      hankoShaft,
      hankoCap,
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const geom of Object.values(geometries)) {
        geom.dispose();
      }
    };
  }, [geometries]);

  // Static desk, card, and hanko textures + materials (disposed on unmount).
  const staticResources = useMemo(() => {
    const woodTex = createWoodTexture();
    if (woodTex) {
      woodTex.repeat.set(0.32, 0.32);
    }
    const washiBlankTex = createWashiTexture(false);
    const washiRuledTex = createWashiTexture(true);
    const contactTex = createContactShadowTexture();

    const deskMat = new THREE.MeshStandardMaterial({
      color: woodTex ? "#ffffff" : SCENE_TOKENS.deskWood,
      map: woodTex,
      roughness: 0.74,
      metalness: 0.04,
    });
    const shadowOverlayMat = new THREE.ShadowMaterial({
      color: SCENE_TOKENS.inkShadow,
      opacity: 0.11,
      transparent: true,
      depthWrite: false,
    });
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const washiBlankMat = new THREE.MeshStandardMaterial({
      color: washiBlankTex ? "#ffffff" : SCENE_TOKENS.card,
      map: washiBlankTex,
      roughness: 0.88,
      metalness: 0.0,
    });
    const washiEdgeMat = new THREE.MeshStandardMaterial({
      color: "#EDE6DA",
      roughness: 0.9,
      metalness: 0.0,
    });
    const washiRuledMat = new THREE.MeshStandardMaterial({
      color: washiRuledTex ? "#ffffff" : SCENE_TOKENS.card,
      map: washiRuledTex,
      roughness: 0.86,
      metalness: 0.0,
    });
    const easelMat = new THREE.MeshStandardMaterial({
      color: "#5C432D",
      roughness: 0.68,
      metalness: 0.04,
    });
    const plaqueEdgeMat = new THREE.MeshStandardMaterial({
      color: "#EAE2D4",
      roughness: 0.8,
      metalness: 0.02,
    });
    const hankoWoodMat = new THREE.MeshStandardMaterial({
      color: SCENE_TOKENS.hankoWood,
      roughness: 0.48,
      metalness: 0.06,
    });
    const hankoCollarMat = new THREE.MeshStandardMaterial({
      color: "#C4A676",
      roughness: 0.38,
      metalness: 0.35,
    });
    const hankoVermilionMat = new THREE.MeshStandardMaterial({
      color: SCENE_TOKENS.accent,
      roughness: 0.44,
      metalness: 0.04,
    });

    const topCardMaterials: THREE.Material[] = [
      washiEdgeMat,
      washiEdgeMat,
      washiRuledMat,
      washiBlankMat,
      washiEdgeMat,
      washiEdgeMat,
    ];

    return {
      textures: [woodTex, washiBlankTex, washiRuledTex, contactTex],
      hasWoodTex: Boolean(woodTex),
      hasWashiBlankTex: Boolean(washiBlankTex),
      hasWashiRuledTex: Boolean(washiRuledTex),
      materials: {
        deskMat,
        shadowOverlayMat,
        contactMat,
        washiBlankMat,
        washiEdgeMat,
        washiRuledMat,
        easelMat,
        plaqueEdgeMat,
        hankoWoodMat,
        hankoCollarMat,
        hankoVermilionMat,
      },
      topCardMaterials,
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const tex of staticResources.textures) {
        tex?.dispose();
      }
      for (const mat of Object.values(staticResources.materials)) {
        mat.dispose();
      }
    };
  }, [staticResources]);

  // Dynamic Kanji plaque textures + material (rebuilt & disposed whenever level changes).
  const kanjiResources = useMemo(() => {
    const texSet = createKanjiTextures(kanji);
    const frontMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: texSet?.map ?? null,
      bumpMap: texSet?.bumpMap ?? null,
      bumpScale: 0.034,
      roughness: 0.72,
      metalness: 0.02,
    });
    const plaqueMaterials: THREE.Material[] = [
      staticResources.materials.plaqueEdgeMat,
      staticResources.materials.plaqueEdgeMat,
      staticResources.materials.plaqueEdgeMat,
      staticResources.materials.plaqueEdgeMat,
      frontMat,
      staticResources.materials.plaqueEdgeMat,
    ];
    return { texSet, frontMat, plaqueMaterials };
  }, [kanji, staticResources.materials.plaqueEdgeMat]);

  useEffect(() => {
    return () => {
      kanjiResources.texSet?.map.dispose();
      kanjiResources.texSet?.bumpMap.dispose();
      kanjiResources.frontMat.dispose();
    };
  }, [kanjiResources]);

  const isDark = theme === "dark";
  const tokens = useMemo(() => getSceneTokens(theme), [theme]);

  // Sync material colors and shadow opacity cleanly whenever theme or plaque changes.
  useEffect(() => {
    const mats = staticResources.materials;
    mats.deskMat.color.set(
      staticResources.hasWoodTex
        ? isDark
          ? "#948476"
          : "#ffffff"
        : tokens.deskWood,
    );
    mats.shadowOverlayMat.color.set(tokens.inkShadow);
    mats.shadowOverlayMat.opacity = isDark ? 0.28 : 0.11;
    mats.contactMat.opacity = isDark ? 0.8 : 0.65;
    mats.washiBlankMat.color.set(
      staticResources.hasWashiBlankTex
        ? isDark
          ? "#A89E90"
          : "#ffffff"
        : tokens.card,
    );
    mats.washiEdgeMat.color.set(isDark ? "#8D8375" : "#EDE6DA");
    mats.washiRuledMat.color.set(
      staticResources.hasWashiRuledTex
        ? isDark
          ? "#C4BAA9"
          : "#ffffff"
        : tokens.card,
    );
    mats.easelMat.color.set(isDark ? "#3E2E20" : "#5C432D");
    mats.plaqueEdgeMat.color.set(isDark ? "#9E9486" : "#EAE2D4");
    mats.hankoWoodMat.color.set(tokens.hankoWood);
    mats.hankoCollarMat.color.set(isDark ? "#A0855B" : "#C4A676");
    mats.hankoVermilionMat.color.set(tokens.accent);
    kanjiResources.frontMat.color.set(isDark ? "#D2C8B8" : "#ffffff");
    invalidate();
  }, [isDark, tokens, staticResources, kanjiResources, invalidate]);

  // Configure tight directional shadow camera bounds once mounted.
  useEffect(() => {
    const light = keyLightRef.current;
    if (!light) return;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -3.4;
    light.shadow.camera.right = 3.4;
    light.shadow.camera.top = 2.6;
    light.shadow.camera.bottom = -2.6;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 16;
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.025;
    light.shadow.radius = 3.5;
    invalidate();
  }, [invalidate]);

  // Gentle turn-in animation whenever the selected JLPT level changes.
  useEffect(() => {
    if (prevKanjiRef.current !== kanji) {
      prevKanjiRef.current = kanji;
      plaqueTurnRef.current = 0.24;
      invalidate();
    }
  }, [kanji, invalidate]);

  // Subtle pointer / touch parallax (clamped strictly <= 4 deg) driving on-demand frames.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateTarget = (clientX: number, clientY: number) => {
      if (!onscreenRef.current || document.hidden) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = THREE.MathUtils.clamp((clientX / w) * 2 - 1, -1, 1);
      const ny = THREE.MathUtils.clamp((clientY / h) * 2 - 1, -1, 1);
      targetParallaxRef.current.x = nx;
      targetParallaxRef.current.y = ny;
      invalidate();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      updateTarget(event.clientX, event.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      updateTarget(touch.clientX, touch.clientY);
    };

    const onPointerLeave = () => {
      targetParallaxRef.current.x = 0;
      targetParallaxRef.current.y = 0;
      if (onscreenRef.current && !document.hidden) invalidate();
    };

    const syncVisibility = () => {
      expectingNextFrameRef.current = false;
      fpsWindowRef.current = { elapsed: 0, frames: 0 };
      onPointerLeave();
    };
    const observer = new IntersectionObserver(([entry]) => {
      onscreenRef.current = entry?.isIntersecting ?? false;
      syncVisibility();
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("mouseleave", onPointerLeave);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("blur", onPointerLeave);
      document.removeEventListener("mouseleave", onPointerLeave);
    };
  }, [canvas, invalidate]);

  useFrame((state, rawDelta) => {
    if (!onscreenRef.current || document.hidden) return;
    if (!readyNotifiedRef.current) {
      readyNotifiedRef.current = true;
      onReady();
    }

    // Measure sustained FPS only when the previous frame explicitly requested this frame.
    if (
      expectingNextFrameRef.current &&
      !reportedLowPerfRef.current &&
      rawDelta > 0.001
    ) {
      const win = fpsWindowRef.current;
      win.elapsed += rawDelta;
      win.frames += 1;
      if (win.elapsed >= 2.0) {
        const avgFps = win.frames / win.elapsed;
        win.elapsed = 0;
        win.frames = 0;
        if (!dprDegradedRef.current && avgFps < 50) {
          dprDegradedRef.current = true;
          state.setDpr(1);
        } else if (dprDegradedRef.current && avgFps < 50) {
          reportedLowPerfRef.current = true;
          expectingNextFrameRef.current = false;
          onLowPerf();
          return;
        }
      }
    }

    const dt = Math.min(rawDelta, 0.1);
    const damp = 1 - Math.exp(-6.5 * dt);

    const cur = currentParallaxRef.current;
    const tgt = targetParallaxRef.current;
    cur.x += (tgt.x - cur.x) * damp;
    cur.y += (tgt.y - cur.y) * damp;

    const yaw = cur.x * MAX_YAW_RAD;
    const elevation = BASE_ELEVATION - cur.y * MAX_PITCH_RAD;
    const horiz = Math.cos(elevation) * CAMERA_RADIUS;

    state.camera.position.set(
      LOOK_AT_TARGET.x + Math.sin(yaw) * horiz,
      LOOK_AT_TARGET.y + Math.sin(elevation) * CAMERA_RADIUS,
      LOOK_AT_TARGET.z + Math.cos(yaw) * horiz,
    );
    state.camera.lookAt(LOOK_AT_TARGET);

    if (plaqueGroupRef.current) {
      if (Math.abs(plaqueTurnRef.current) > 0.0008) {
        plaqueTurnRef.current *= Math.exp(-8 * dt);
      } else {
        plaqueTurnRef.current = 0;
      }
      plaqueGroupRef.current.rotation.y = -0.18 + plaqueTurnRef.current;
    }

    const stillMoving =
      Math.abs(tgt.x - cur.x) > 0.0005 ||
      Math.abs(tgt.y - cur.y) > 0.0005 ||
      Math.abs(plaqueTurnRef.current) > 0.0008;

    expectingNextFrameRef.current = stillMoving;
    if (stillMoving) {
      state.invalidate();
    }
  });

  const { materials, topCardMaterials } = staticResources;

  return (
    <>
      {/* Calm daylight in light mode, warm desk lamp over Sumi night desk in dark mode */}
      <ambientLight
        color={isDark ? "#2E3548" : "#FFF8EE"}
        intensity={isDark ? 0.28 : 0.68}
      />
      <hemisphereLight
        color={isDark ? "#46526E" : "#FFFDF8"}
        groundColor={tokens.deskWood}
        intensity={isDark ? 0.34 : 0.56}
      />
      <directionalLight
        ref={keyLightRef}
        position={[-4.0, 5.8, 3.6]}
        color={isDark ? "#C7D4EE" : "#FFF4E4"}
        intensity={isDark ? 0.56 : 1.72}
        castShadow
      />
      <directionalLight
        position={[3.8, 3.0, 2.8]}
        color={isDark ? "#4E5C7C" : "#F5EFE6"}
        intensity={isDark ? 0.24 : 0.48}
      />
      <pointLight
        position={isDark ? [1.45, 2.0, 1.55] : [2.0, 1.25, 1.35]}
        color={tokens.lamp}
        intensity={isDark ? 5.2 : 1.6}
        distance={isDark ? 7.5 : 4.8}
        decay={isDark ? 1.8 : 2}
      />

      {/* Beveled wooden desk plane */}
      <mesh
        geometry={geometries.desk}
        material={materials.deskMat}
        receiveShadow
      />

      {/* Soft ink-shadow receiver layer for crisp low-opacity shadow readability */}
      <mesh
        geometry={geometries.deskShadowPlane}
        material={materials.shadowOverlayMat}
        rotation-x={-Math.PI / 2}
        position={[0, 0.002, 0]}
        receiveShadow
      />

      {/* Grounding contact shadows beneath each desk prop */}
      <mesh
        geometry={geometries.contactQuad}
        material={materials.contactMat}
        rotation-x={-Math.PI / 2}
        position={[-0.95, 0.001, 0.24]}
        scale={[2.05, 1.45, 1]}
      />
      <mesh
        geometry={geometries.contactQuad}
        material={materials.contactMat}
        rotation-x={-Math.PI / 2}
        position={[0.74, 0.001, -0.14]}
        scale={[2.0, 1.05, 1]}
      />
      <mesh
        geometry={geometries.contactQuad}
        material={materials.contactMat}
        rotation-x={-Math.PI / 2}
        position={[1.86, 0.001, 0.54]}
        scale={[0.68, 0.68, 1]}
      />

      {/* Stack of 5 Washi flashcards (left-front) */}
      <group position={[-0.95, 0, 0.24]} rotation={[0, 0.14, 0]}>
        {CARD_STACK.map((card, index) => {
          const isTop = index === CARD_STACK.length - 1;
          return (
            <mesh
              key={card.rotY}
              geometry={geometries.card}
              material={isTop ? topCardMaterials : materials.washiBlankMat}
              position={[card.x, 0.012 + index * 0.025, card.z]}
              rotation={[0, card.rotY, 0]}
              castShadow
              receiveShadow
            />
          );
        })}
      </group>

      {/* Kanji display plaque on wooden easel (center-right) */}
      <group
        ref={plaqueGroupRef}
        position={[0.74, 0, -0.14]}
        rotation={[0, -0.18, 0]}
      >
        <mesh
          geometry={geometries.easelBase}
          material={materials.easelMat}
          position={[0, 0.055, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.easelBack}
          material={materials.easelMat}
          position={[0, 0.45, -0.17]}
          rotation={[0.24, 0, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.plaque}
          material={kanjiResources.plaqueMaterials}
          position={[0, 0.82, 0.02]}
          rotation={[-0.22, 0, 0]}
          castShadow
          receiveShadow
        />
      </group>

      {/* Dark-wood Hanko stamp with vermilion base (right-front) */}
      <group position={[1.86, 0, 0.54]}>
        <mesh
          geometry={geometries.hankoBase}
          material={materials.hankoVermilionMat}
          position={[0, 0.055, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.hankoCollar}
          material={materials.hankoCollarMat}
          position={[0, 0.126, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.hankoShaft}
          material={materials.hankoWoodMat}
          position={[0, 0.452, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.hankoCap}
          material={materials.hankoWoodMat}
          position={[0, 0.762, 0]}
          scale={[1, 0.42, 1]}
          castShadow
          receiveShadow
        />
      </group>
    </>
  );
}

export default function DeskHeroCanvas({
  level,
  theme,
  onReady,
  onLowPerf,
  onContextLost,
}: DeskHeroCanvasProps): JSX.Element {
  const { resolved } = useThemePreference();
  const activeTheme = theme ?? resolved;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [root, setRoot] = useState<ReconcilerRoot<HTMLCanvasElement> | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    extend({
      AmbientLight: THREE.AmbientLight,
      DirectionalLight: THREE.DirectionalLight,
      Group: THREE.Group,
      HemisphereLight: THREE.HemisphereLight,
      Mesh: THREE.Mesh,
      PointLight: THREE.PointLight,
    });
    const sceneRoot = createRoot(canvas);
    let active = true;
    let observer: ResizeObserver | undefined;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleLost);

    void sceneRoot
      .configure({
        frameloop: "demand",
        dpr: [1, 2],
        shadows: "percentage",
        gl: {
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        },
        camera: { position: [0, 2.7, 5.2], fov: 36, near: 0.1, far: 30 },
        size: {
          width: container.clientWidth,
          height: container.clientHeight,
          top: 0,
          left: 0,
        },
        onCreated: (state) => {
          if (!active) return;
          state.gl.setClearColor(0x000000, 0);
          state.gl.toneMapping = THREE.ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.0;
          let lastWidth = container.clientWidth;
          let lastHeight = container.clientHeight;
          observer = new ResizeObserver(() => {
            const nextWidth = container.clientWidth;
            const nextHeight = container.clientHeight;
            if (nextWidth === lastWidth && nextHeight === lastHeight) return;
            lastWidth = nextWidth;
            lastHeight = nextHeight;
            state.setSize(nextWidth, nextHeight);
          });
          observer.observe(container);
        },
      })
      .then(() => {
        if (active) setRoot(sceneRoot);
      })
      .catch(() => {
        if (active) onContextLost();
      });

    return () => {
      active = false;
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", handleLost);
      sceneRoot.unmount();
    };
  }, [onContextLost]);

  useEffect(() => {
    root?.render(
      <ErrorBoundary3D fallback={null} onError={onContextLost}>
        <DeskScene
          kanji={getKanjiForLevel(level)}
          theme={activeTheme}
          onReady={onReady}
          onLowPerf={onLowPerf}
        />
      </ErrorBoundary3D>,
    );
  }, [root, level, activeTheme, onReady, onLowPerf, onContextLost]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
