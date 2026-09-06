/* Chapter 4 (reception night): warm golden bokeh: THREE.Points with a soft
   radial-gradient sprite drawn on a canvas (no external texture), additive
   blending, attenuated sizes, slow firefly drift upward. Opacity follows the
   reception scroll window but never drops below a 0.15 ambient floor. */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProgress } from '../../scroll/progress';
import { useSceneTheme } from '../Experience';

const COUNT = 320;
const BOUNDS = { x: 7, y: 4.2, z: 4 };

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/* Two sprites. "glow" is the untouched night sprite (bright core, additive).
   "foil" is white with a soft alpha disc and a faint brighter rim: with the
   multiply-with-alpha blend below, the tint comes from the vertex color and
   the disc deepens whatever is behind it, like a gold sequin in daylight. */
function makeBokehSprite(kind: 'glow' | 'foil'): THREE.CanvasTexture {
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
    if (kind === 'glow') {
      g.addColorStop(0, 'rgba(255, 246, 224, 1)');
      g.addColorStop(0.3, 'rgba(226, 200, 146, 0.7)');
      g.addColorStop(0.7, 'rgba(201, 169, 110, 0.18)');
      g.addColorStop(1, 'rgba(201, 169, 110, 0)');
    } else {
      g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      g.addColorStop(0.45, 'rgba(255, 255, 255, 0.8)');
      g.addColorStop(0.62, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.7, 'rgba(255, 255, 255, 0.35)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function BokehParticles() {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const sceneTheme = useSceneTheme();
  const targetColor = useMemo(() => new THREE.Color(), []);

  const sprites = useMemo(() => ({ glow: makeBokehSprite('glow'), foil: makeBokehSprite('foil') }), []);
  const paletteKey = useRef('');

  const { geometry, baseX, speeds, phases, strengths } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3).fill(1);
    const bX = new Float32Array(COUNT);
    const spd = new Float32Array(COUNT);
    const ph = new Float32Array(COUNT);
    const str = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      str[i] = Math.random();
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
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { geometry: geo, baseX: bX, speeds: spd, phases: ph, strengths: str };
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
      /* Warm up gradually through the back half of the page ("evening").
         Base and gain are themed: day mode keeps bokeh faint so it never
         muddies text on the light background. */
      const p = Math.min(1, Math.max(0, (getProgress() - 0.45) / 0.4));
      material.opacity = sceneTheme.bokehBase + sceneTheme.bokehGain * easeInOutSine(p);

      targetColor.set(sceneTheme.bokehColor);
      material.color.lerp(targetColor, Math.min(1, delta * 5));

      material.size += (sceneTheme.bokehSize - material.size) * Math.min(1, delta * 5);

      /* Per-theme render mode. Night: the original additive glow, untouched.
         Day: gold-foil discs via a custom multiply-with-alpha blend
         (out = dst * mix(1, tint, alpha)) with a per-particle palette. Both
         flags need a shader recompile, so they hard-swap once per theme. */
      const key = sceneTheme.bokehPalette.join();
      if (paletteKey.current !== key) {
        paletteKey.current = key;
        const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
        const c = new THREE.Color();
        const white = new THREE.Color('#ffffff');
        for (let i = 0; i < COUNT; i++) {
          c.set(sceneTheme.bokehPalette[i % sceneTheme.bokehPalette.length]);
          /* Foil strength per particle: most discs are faint, roughly one in
             five is a full-strength sequin, so the field reads like the
             night sky (a few bright stars over a soft dust) instead of an
             even polka dot. Multiply mode: faint = tint mixed toward white. */
          if (sceneTheme.bokehFoil) {
            const strength = strengths[i] < 0.7 ? 0.05 + strengths[i] * 0.12 : 0.85 + (strengths[i] - 0.7);
            c.copy(white).lerp(c, strength);
          }
          attr.setXYZ(i, c.r, c.g, c.b);
        }
        attr.needsUpdate = true;
      }
      const wantFoil = sceneTheme.bokehFoil;
      const isFoil = material.blending === THREE.CustomBlending;
      if (wantFoil !== isFoil) {
        if (wantFoil) {
          material.map = sprites.foil;
          material.blending = THREE.CustomBlending;
          material.blendEquation = THREE.AddEquation;
          material.blendSrc = THREE.DstColorFactor;
          material.blendDst = THREE.OneMinusSrcAlphaFactor;
          material.premultipliedAlpha = true;
          material.vertexColors = true;
          material.toneMapped = false;
        } else {
          material.map = sprites.glow;
          material.blending = sceneTheme.bokehAdditive ? THREE.AdditiveBlending : THREE.NormalBlending;
          material.premultipliedAlpha = false;
          material.vertexColors = false;
          material.toneMapped = true;
        }
        material.needsUpdate = true;
      }
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        map={sprites.glow}
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

/* Day-only "glints": the light half of the daylight sparkle. Small white
   points with a bright core drifting like the bokeh, normal blending, so
   they read as sunlit dust and champagne bubbles against the ivory wash.
   Faded out and hidden at night. */
const GLINT_COUNT = 220;

export function DayGlints() {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const sceneTheme = useSceneTheme();
  const sprite = useMemo(() => makeBokehSprite('glow'), []);

  const { geometry, baseX, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(GLINT_COUNT * 3);
    const bX = new Float32Array(GLINT_COUNT);
    const spd = new Float32Array(GLINT_COUNT);
    const ph = new Float32Array(GLINT_COUNT);
    for (let i = 0; i < GLINT_COUNT; i++) {
      const x = (Math.random() - 0.5) * 2 * BOUNDS.x;
      positions[i * 3] = x;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * BOUNDS.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * BOUNDS.z;
      bX[i] = x;
      spd[i] = 0.06 + Math.random() * 0.18;
      ph[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, baseX: bX, speeds: spd, phases: ph };
  }, []);

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const target = sceneTheme.glintOpacity;
    material.opacity += (target - material.opacity) * Math.min(1, delta * 5);
    material.visible = material.opacity > 0.01;
    if (!material.visible) return;

    const t = clock.elapsedTime;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < GLINT_COUNT; i++) {
      let y = arr[i * 3 + 1] + speeds[i] * delta;
      if (y > BOUNDS.y) y = -BOUNDS.y;
      arr[i * 3 + 1] = y;
      arr[i * 3] = baseX[i] + Math.sin(t * 0.25 * speeds[i] * 8 + phases[i]) * 0.3;
    }
    attr.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        map={sprite}
        color="#ffffff"
        size={0.28}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
