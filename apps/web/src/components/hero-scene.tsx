"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// 3D drawn over the photograph: drifting snow and mist motes at several depths that shift slightly with the pointer.
// The canvas is transparent, so the photo stays the star.

const MOTE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    vec3 p = position;
    float speed = 0.2 + aSeed * 0.5;
    p.x = mod(p.x + uTime * speed + 10.0, 20.0) - 10.0;
    p.y = mod(p.y - uTime * 0.1 * (0.4 + aSeed) + 5.0, 10.0) - 5.0 + sin(uTime * 0.4 + aSeed * 30.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = max(uScale * (0.025 + aSeed * 0.06) / -mv.z, 1.0);
    vA = 0.2 + 0.55 * aSeed;
    gl_Position = projectionMatrix * mv;
  }
`;
const MOTE_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.92, 0.96, 1.0, vA * smoothstep(0.5, 0.05, d));
  }
`;

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Motes({ count, pointer, reduced }: { count: number; pointer: React.RefObject<{ x: number; y: number }>; reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const rand = seeded(11);
    for (let i = 0; i < count; i++) {
      pos.set([(rand() - 0.5) * 20, (rand() - 0.5) * 10, -6 + rand() * 9], i * 3);
      seed[i] = rand();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uScale: { value: 700 } }), []);

  useFrame((_, dt) => {
    if (mat.current) {
      if (!reduced) mat.current.uniforms.uTime.value += dt;
      mat.current.uniforms.uScale.value = size.height * 1.1;
    }
    if (group.current && pointer.current) {
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, -pointer.current.x * 0.5, 2.5, dt);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, -pointer.current.y * 0.3, 2.5, dt);
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={mat}
          vertexShader={MOTE_VERT}
          fragmentShader={MOTE_FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export default function HeroScene({ reducedMotion, lowPower }: { reducedMotion: boolean; lowPower: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [reducedMotion]);

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0">
      <Canvas
        dpr={[1, lowPower ? 1.25 : 1.75]}
        camera={{ position: [0, 0, 8], fov: 40, near: 0.1, far: 60 }}
        frameloop={visible && !reducedMotion ? "always" : "demand"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        aria-hidden
      >
        <Motes count={lowPower ? 220 : 520} pointer={pointer} reduced={reducedMotion} />
      </Canvas>
    </div>
  );
}
