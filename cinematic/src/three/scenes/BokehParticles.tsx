/* Chapter 4 (reception night): warm golden bokeh — THREE.Points with a soft
   radial-gradient sprite drawn on a canvas (no external texture), additive
   blending, attenuated sizes, slow firefly drift upward. Opacity follows the
   reception scroll window but never drops below a 0.15 ambient floor. */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProgress } from '../../scroll/progress';

const COUNT = 320;
const BOUNDS = { x: 7, y: 4.2, z: 4 };

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

function makeBokehSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    g.addColorStop(0, 'rgba(255, 246, 224, 1)');
    g.addColorStop(0.3, 'rgba(226, 200, 146, 0.7)');
    g.addColorStop(0.7, 'rgba(201, 169, 110, 0.18)');
    g.addColorStop(1, 'rgba(201, 169, 110, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function BokehParticles() {
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const sprite = useMemo(makeBokehSprite, []);

  const { geometry, baseX, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const bX = new Float32Array(COUNT);
    const spd = new Float32Array(COUNT);
    const ph = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 2 * BOUNDS.x;
      positions[i * 3] = x;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * BOUNDS.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * BOUNDS.z;
      bX[i] = x;
      spd[i] = 0.08 + Math.random() * 0.22;
      ph[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, baseX: bX, speeds: spd, phases: ph };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      /* Slow rise + lateral sway, wrapping back to the bottom. */
      let y = arr[i * 3 + 1] + speeds[i] * delta;
      if (y > BOUNDS.y) y = -BOUNDS.y;
      arr[i * 3 + 1] = y;
      arr[i * 3] = baseX[i] + Math.sin(t * 0.3 * speeds[i] * 8 + phases[i]) * 0.35;
    }
    attr.needsUpdate = true;

    const material = materialRef.current;
    if (material) {
      /* Warm up gradually through the back half of the page ("evening"). */
      const p = Math.min(1, Math.max(0, (getProgress() - 0.45) / 0.4));
      material.opacity = 0.12 + 0.55 * easeInOutSine(p);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        map={sprite}
        color="#e2c892"
        size={0.34}
        sizeAttenuation
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
