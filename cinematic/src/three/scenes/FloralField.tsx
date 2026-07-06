/* Ambient petals drifting at the frame edges — the only "florals" in the
   scene. No photo billboards: content stays king, petals stay peripheral.
   The center is kept clear so text is never crossed at any viewport width. */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const PETAL_COUNT = 36;

const PETAL_COLORS = ['#e8c9c4', '#f7f3ec', '#c9a96e', '#e2c892', '#fffdf9'];

interface PetalSeed {
  base: readonly [number, number, number];
  scale: number;
  phase: number;
  speed: number;
  spin: readonly [number, number, number];
  colorIndex: number;
}

function makeSeeds(): PetalSeed[] {
  const seeds: PetalSeed[] = [];
  for (let i = 0; i < PETAL_COUNT; i++) {
    /* Two vertical bands, left and right of the content column. */
    const side = i % 2 === 0 ? -1 : 1;
    const radius = 3.2 + Math.random() * 3.5;
    seeds.push({
      base: [
        side * radius,
        (Math.random() - 0.5) * 7,
        (Math.random() - 0.5) * 4,
      ],
      scale: 0.1 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.4,
      spin: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ],
      colorIndex: Math.floor(Math.random() * PETAL_COLORS.length),
    });
  }
  return seeds;
}

export function FloralField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const seeds = useMemo(makeSeeds, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const petalGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 12, 10), []);
  const petalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.65,
        metalness: 0.05,
        emissive: new THREE.Color('#c9a96e'),
        emissiveIntensity: 0.05,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    [],
  );

  /* Per-instance colors, set once. */
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < PETAL_COUNT; i++) {
      color.set(PETAL_COLORS[seeds[i].colorIndex]);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const s = seeds[i];
      dummy.position.set(
        s.base[0] + Math.sin(t * s.speed + s.phase) * 0.3,
        s.base[1] + Math.sin(t * s.speed * 0.7 + s.phase * 2.0) * 0.45,
        s.base[2] + Math.cos(t * s.speed * 0.85 + s.phase) * 0.25,
      );
      dummy.rotation.set(
        s.spin[0] + t * 0.1 * s.speed,
        s.spin[1] + t * 0.16 * s.speed,
        s.spin[2] + Math.sin(t * 0.3 + s.phase) * 0.35,
      );
      dummy.scale.set(s.scale, s.scale * 0.14, s.scale * 0.55);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[petalGeometry, petalMaterial, PETAL_COUNT]}
      frustumCulled={false}
    />
  );
}
