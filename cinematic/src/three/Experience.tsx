import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getProgress } from '../scroll/progress';
import { getTheme, subscribeTheme } from '../theme/theme';
import type { Theme } from '../theme/theme';
import { FloralField } from './scenes/FloralField';
import { BokehParticles, DayGlints } from './scenes/BokehParticles';
import { SilkBackdrop } from './scenes/SilkBackdrop';

/* Ambient backdrop only: content is king. A static camera with a whisper of
   mouse/scroll drift; petals at the frame edges, bokeh that warms as you
   scroll toward the pricing/CTA "evening", dim silk far behind.

   Wave 5: the whole scene is theme-aware. Night keeps the exact pre-wave-5
   values (regression guard); day re-lights the same world in warm ivory so
   petals and bokeh read as soft gold on cream. Colors lerp on theme change
   behind the 0.5s CSS transition. */

export interface SceneTheme {
  bg: string;
  fog: string;
  ambientIntensity: number;
  ambientColor: string;
  keyIntensity: number;
  /* Scroll warmth curve: key light color = base minus warmth * dropoff.
     Night drifts to amber; day warms toward late-afternoon gold. */
  keyBase: [number, number, number];
  keyWarmDrop: [number, number, number];
  exposure: number;
  petalOpacity: number;
  petalEmissive: number;
  bokehColor: string;
  bokehBase: number;
  bokehGain: number;
  bokehAdditive: boolean;
  /* Day mode: bokeh switches from additive glow to "gold foil": a
     multiply-with-alpha blend so each disc deepens the ivory behind it the
     way gold leaf or confetti reads against daylight. Per-particle tints. */
  bokehFoil: boolean;
  bokehPalette: string[];
  bokehSize: number;
  /* Day-only white glints (sunlit dust) layered under the foil. */
  glintOpacity: number;
  petalColors: string[];
  petalRoughness: number;
  /* Sunlit wash: a far gradient plane (top-left, top-right, bottom-left,
     bottom-right) that gives the flat background depth. 0 opacity = off. */
  washOpacity: number;
  washColors: [string, string, string, string];
  silkTint: string;
  silkFallback: string;
}

export const THEME_SCENE: Record<Theme, SceneTheme> = {
  night: {
    bg: '#0d1117',
    fog: '#0d1117',
    ambientIntensity: 0.9,
    ambientColor: '#f7f3ec',
    keyIntensity: 40,
    keyBase: [1, 0.94, 0.85],
    keyWarmDrop: [0, 0.12, 0.25],
    exposure: 1.1,
    petalOpacity: 0.75,
    petalEmissive: 0.05,
    bokehColor: '#e2c892',
    bokehBase: 0.12,
    bokehGain: 0.55,
    bokehAdditive: true,
    bokehFoil: false,
    bokehPalette: ['#ffffff'],
    bokehSize: 0.34,
    glintOpacity: 0,
    petalColors: ['#e8c9c4', '#f7f3ec', '#c9a96e', '#e2c892', '#fffdf9'],
    petalRoughness: 0.65,
    washOpacity: 0,
    washColors: ['#0d1117', '#0d1117', '#0d1117', '#0d1117'],
    silkTint: '#211e19',
    silkFallback: '#161b22',
  },
  day: {
    bg: '#f4eee4',
    fog: '#f4eee4',
    ambientIntensity: 1.0,
    ambientColor: '#fffdf9',
    keyIntensity: 46,
    keyBase: [1, 0.93, 0.8],
    keyWarmDrop: [0, 0.1, 0.22],
    exposure: 1.0,
    petalOpacity: 0.92,
    petalEmissive: 0.0,
    bokehColor: '#ffffff',
    bokehBase: 0.55,
    bokehGain: 0.3,
    bokehAdditive: false,
    bokehFoil: true,
    /* Gold leaf, bronze, champagne, a little blush and one ink accent. */
    bokehPalette: ['#c9a96e', '#b8965a', '#a17b3f', '#d9b56f', '#c9a96e', '#e0a99a', '#8a6d3e'],
    bokehSize: 0.42,
    glintOpacity: 0.95,
    petalColors: ['#c9a96e', '#b8965a', '#e3b3a6', '#d9bf85', '#a17b3f'],
    petalRoughness: 0.35,
    washOpacity: 1,
    washColors: ['#fffdf9', '#f0dec0', '#f5e2d8', '#ebdec6'],
    silkTint: '#d8cfbf',
    silkFallback: '#ece5d8',
  },
};

export function useSceneTheme(): SceneTheme {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'night' as Theme);
  return THEME_SCENE[theme];
}

/* Pause the render loop while the tab is hidden or the stage is scrolled
   fully offscreen (the stage is fixed, so the observer is a safety net for
   future layouts). */
function FrameloopGovernor({ stage }: { stage: HTMLElement | null }) {
  const setFrameloop = useThree((state) => state.setFrameloop);
  const hidden = useRef(false);
  const offscreen = useRef(false);

  useEffect(() => {
    const apply = () => setFrameloop(hidden.current || offscreen.current ? 'never' : 'always');
    const onVisibility = () => {
      hidden.current = document.hidden;
      apply();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let io: IntersectionObserver | undefined;
    if (stage && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        offscreen.current = entries.some((e) => !e.isIntersecting);
        apply();
      });
      io.observe(stage);
    }
    onVisibility();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
    };
  }, [setFrameloop, stage]);

  return null;
}

function CameraRig() {
  const { camera, pointer } = useThree();
  const drift = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = getProgress();

    drift.current.x += (pointer.x * 0.25 - drift.current.x) * 0.03;
    drift.current.y += (pointer.y * 0.15 - drift.current.y) * 0.03;

    camera.position.x = drift.current.x + Math.sin(t * 0.1) * 0.06;
    camera.position.y = drift.current.y + Math.cos(t * 0.08) * 0.05 - p * 0.6;
    camera.rotation.y = -drift.current.x * 0.04;
  });

  return null;
}

function Atmosphere() {
  const key = useRef<THREE.PointLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const scene = useSceneTheme();
  const targets = useRef({
    bg: new THREE.Color(THEME_SCENE[getTheme()].bg),
    fog: new THREE.Color(THEME_SCENE[getTheme()].fog),
    keyColor: new THREE.Color(),
    ambientColor: new THREE.Color(THEME_SCENE[getTheme()].ambientColor),
  });

  useFrame((state, delta) => {
    const k = Math.min(1, delta * 5);
    const t = targets.current;

    /* Scroll warmth inside the current theme's curve. */
    const warmth = Math.min(1, getProgress() * 1.4);
    t.keyColor.setRGB(
      scene.keyBase[0] - warmth * scene.keyWarmDrop[0],
      scene.keyBase[1] - warmth * scene.keyWarmDrop[1],
      scene.keyBase[2] - warmth * scene.keyWarmDrop[2],
    );

    /* Lerp background, fog, lights and exposure toward the theme targets. */
    t.bg.set(scene.bg);
    t.fog.set(scene.fog);
    t.ambientColor.set(scene.ambientColor);

    const world = state.scene;
    if (world.background instanceof THREE.Color) world.background.lerp(t.bg, k);
    if (world.fog) world.fog.color.lerp(t.fog, k);
    state.gl.toneMappingExposure += (scene.exposure - state.gl.toneMappingExposure) * k;

    if (key.current) {
      key.current.color.lerp(t.keyColor, Math.min(1, delta * 8));
      key.current.intensity += (scene.keyIntensity - key.current.intensity) * k;
    }
    if (ambient.current) {
      ambient.current.color.lerp(t.ambientColor, k);
      ambient.current.intensity += (scene.ambientIntensity - ambient.current.intensity) * k;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.9} color="#f7f3ec" />
      <pointLight ref={key} position={[2.5, 3, 4]} intensity={40} distance={0} decay={2} color="#fff2df" />
      <fog attach="fog" args={[THEME_SCENE[getTheme()].fog, 10, 30]} />
    </>
  );
}

/* Far gradient plane (fog off) painted with four corner colors: ivory light
   from the top-left, a champagne glow top-right, a breath of blush bottom
   left. Faded out entirely at night so the regression guard holds. */
function DayWash() {
  const scene = useSceneTheme();
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useMemo(() => {
    /* Sized to the visible frustum at z=-20 (camera at 6, fov 42) so the
       four corners land at the viewport corners, with slack for drift. */
    const geo = new THREE.PlaneGeometry(44, 26, 1, 1);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    return geo;
  }, []);
  const scratch = useMemo(() => ({ target: new THREE.Color(), current: new THREE.Color() }), []);

  useFrame((_, delta) => {
    const k = Math.min(1, delta * 5);
    const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
    /* PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right. */
    for (let i = 0; i < 4; i++) {
      scratch.target.set(scene.washColors[i]);
      scratch.current.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i)).lerp(scratch.target, k);
      attr.setXYZ(i, scratch.current.r, scratch.current.g, scratch.current.b);
    }
    attr.needsUpdate = true;
    if (materialRef.current) {
      materialRef.current.opacity += (scene.washOpacity - materialRef.current.opacity) * k;
      materialRef.current.visible = materialRef.current.opacity > 0.01;
    }
  });

  return (
    <mesh geometry={geometry} position={[0, 0, -20]}>
      <meshBasicMaterial ref={materialRef} vertexColors transparent opacity={0} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

export function Experience() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  /* Phones keep the tighter pixel-ratio cap (Part 7.1). */
  const maxDpr = typeof window !== 'undefined' && window.innerWidth < 720 ? 1.5 : 1.75;

  return (
    <div className="webgl-stage" ref={setStage}>
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 60, position: [0, 0, 6] }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = THEME_SCENE[getTheme()].exposure;
          scene.background = new THREE.Color(THEME_SCENE[getTheme()].bg);
          if (import.meta.env.DEV) (window as unknown as { __scene?: THREE.Scene }).__scene = scene;
        }}
        dpr={[1, maxDpr]}
      >
        <FrameloopGovernor stage={stage} />
        <CameraRig />
        <Atmosphere />
        <group position={[0, 0, -2]}>
          <FloralField />
        </group>
        <group position={[0, 0, -4]}>
          <BokehParticles />
        </group>
        <group position={[0, 0, -5]}>
          <DayGlints />
        </group>
        <DayWash />
        <group position={[0, 0, -22]}>
          <SilkBackdrop />
        </group>
      </Canvas>
    </div>
  );
}
