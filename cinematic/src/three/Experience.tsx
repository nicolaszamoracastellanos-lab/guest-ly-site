import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getProgress } from '../scroll/progress';
import { FloralField } from './scenes/FloralField';
import { BokehParticles } from './scenes/BokehParticles';
import { SilkBackdrop } from './scenes/SilkBackdrop';

/* Ambient backdrop only — content is king. A static camera with a whisper of
   mouse/scroll drift; petals at the frame edges, bokeh that warms as you
   scroll toward the pricing/CTA "evening", dim silk far behind. */

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

  useFrame(() => {
    /* Day → night: ivory light at the top of the page, amber by the end. */
    const warmth = Math.min(1, getProgress() * 1.4);
    if (key.current) {
      key.current.color.setRGB(1, 0.94 - warmth * 0.12, 0.85 - warmth * 0.25);
    }
  });

  return (
    <>
      <ambientLight intensity={0.9} color="#f7f3ec" />
      <pointLight ref={key} position={[2.5, 3, 4]} intensity={40} distance={0} decay={2} color="#fff2df" />
      <fog attach="fog" args={['#0d1117', 10, 30]} />
    </>
  );
}

export function Experience() {
  return (
    <div className="webgl-stage">
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 60, position: [0, 0, 6] }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          scene.background = new THREE.Color('#0d1117');
          if (import.meta.env.DEV) (window as unknown as { __scene?: THREE.Scene }).__scene = scene;
        }}
        dpr={[1, 1.75]}
      >
        <CameraRig />
        <Atmosphere />
        <group position={[0, 0, -2]}>
          <FloralField />
        </group>
        <group position={[0, 0, -4]}>
          <BokehParticles />
        </group>
        <group position={[0, 0, -22]}>
          <SilkBackdrop />
        </group>
      </Canvas>
    </div>
  );
}
