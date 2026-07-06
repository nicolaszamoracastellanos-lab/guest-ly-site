/* A vast, dim silk plane far behind every chapter. Low-poly plane whose
   vertices ripple slowly (z displaced by layered sines in useFrame), color
   multiplied toward ink so it never overpowers, with a slight parallax
   rotation from the global scroll progress. */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProgress } from '../../scroll/progress';
import { useSafeTexture } from './useSafeTexture';

const WIDTH = 60;
const HEIGHT = 34;
const SEG_X = 48;
const SEG_Y = 28;

export function SilkBackdrop() {
  const groupRef = useRef<THREE.Group>(null);

  const silkTexture = useSafeTexture('/textures/silk.jpg');

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(WIDTH, HEIGHT, SEG_X, SEG_Y),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

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
          /* Color-multiplied toward ink so the silk stays a whisper. */
          <meshBasicMaterial map={silkTexture} color="#211e19" toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#161b22" toneMapped={false} />
        )}
      </mesh>
    </group>
  );
}
