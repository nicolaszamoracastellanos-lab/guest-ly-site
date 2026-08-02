/* A vast, dim silk plane far behind every chapter. Low-poly plane whose
   vertices ripple slowly (z displaced by layered sines in useFrame), color
   multiplied toward ink so it never overpowers, with a slight parallax
   rotation from the global scroll progress. */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProgress } from '../../scroll/progress';
import { useSafeTexture } from './useSafeTexture';
import { useSceneTheme } from '../Experience';

const WIDTH = 60;
const HEIGHT = 34;
const SEG_X = 48;
const SEG_Y = 28;

export function SilkBackdrop() {
  const groupRef = useRef<THREE.Group>(null);
  const sceneTheme = useSceneTheme();
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const targetTint = useMemo(() => new THREE.Color(), []);

  const silkTexture = useSafeTexture('/textures/silk.jpg');

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(WIDTH, HEIGHT, SEG_X, SEG_Y),
    [],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    /* Theme tint: multiplied toward ink at night, toward warm parchment in
       day mode, so the silk stays a whisper on both backgrounds. */
    if (materialRef.current) {
      targetTint.set(silkTexture ? sceneTheme.silkTint : sceneTheme.silkFallback);
      materialRef.current.color.lerp(targetTint, Math.min(1, delta * 5));
    }

    /* Gentle silk wave: displace z with layered sines over x and y. */
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z =
        Math.sin(x * 0.22 + t * 0.5) * 0.65 +
        Math.sin(y * 0.3 + t * 0.32 + x * 0.08) * 0.45;
      attr.setZ(i, z);
    }
    attr.needsUpdate = true;

    /* Slight parallax from global scroll. */
    const group = groupRef.current;
    if (group) {
      const p = getProgress();
      group.rotation.y = (p - 0.5) * 0.14;
      group.rotation.x = (p - 0.5) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        {silkTexture ? (
          <meshBasicMaterial ref={materialRef} map={silkTexture} color="#211e19" toneMapped={false} />
        ) : (
          <meshBasicMaterial ref={materialRef} color="#161b22" toneMapped={false} />
        )}
      </mesh>
    </group>
  );
}
