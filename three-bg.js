// ═══════════════════════════════════════════════════════
// three-bg.js  ·  Mystery Chat
// Dark floating particle system + CRT glitch shader
// ═══════════════════════════════════════════════════════

let renderer, scene, camera, particlesMesh, glitchTimer = 0;
let bgIntensity = 0.6; // 0..1, controlled by settings slider

const PARTICLE_COUNT  = 1800;
const SPREAD          = 18;

export function initThreeBackground(intensityStart = 0.6) {
  bgIntensity = intensityStart;

  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  // ── Renderer ──
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05060a, 1);

  // ── Scene ──
  scene = new THREE.Scene();

  // ── Camera ──
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 10;

  // ── Particles ──
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors    = new Float32Array(PARTICLE_COUNT * 3);
  const sizes     = new Float32Array(PARTICLE_COUNT);

  const colorPalette = [
    new THREE.Color(0x7c6fff),  // accent purple
    new THREE.Color(0x2dd4bf),  // accent teal
    new THREE.Color(0xf5d020),  // yellow
    new THREE.Color(0x1a1b2e),  // near-dark
    new THREE.Color(0x3a3560),  // mid-dark
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3 + 0] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    sizes[i] = Math.random() * 2.2 + 0.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));

  // ── Shader Material (glitch + CRT + twinkle) ──
  const vertexShader = `
    attribute float size;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uGlitch;

    void main() {
      vColor = color;
      vec3 pos = position;

      // Gentle drift
      pos.x += sin(uTime * 0.18 + position.y * 0.5) * 0.06;
      pos.y += cos(uTime * 0.14 + position.x * 0.4) * 0.06;
      pos.z += sin(uTime * 0.10 + position.z * 0.3) * 0.04;

      // Glitch displacement
      float glitchLine = step(0.94, fract(uTime * 0.8 + position.y * 0.1));
      pos.x += uGlitch * glitchLine * (fract(sin(uTime * 400.0) * 4000.0) - 0.5) * 1.2;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * (8.0 / -mvPosition.z);
      gl_Position  = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
      // Circular particle
      vec2 uv = gl_PointCoord - vec2(0.5);
      float dist = length(uv);
      if (dist > 0.5) discard;

      // Soft edge
      float alpha = (1.0 - dist * 2.0);
      alpha = pow(alpha, 2.0);

      // Twinkle
      float twinkle = 0.75 + 0.25 * sin(uTime * 2.5 + vColor.r * 15.0 + vColor.b * 7.0);
      alpha *= twinkle * uIntensity;

      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uGlitch:    { value: 0 },
      uIntensity: { value: bgIntensity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  particlesMesh = new THREE.Points(geometry, material);
  scene.add(particlesMesh);

  // ── Nebula plane (dark VHS fog) ──
  const fogGeo = new THREE.PlaneGeometry(30, 30);
  const fogMat = new THREE.MeshBasicMaterial({
    color: 0x0a0c18,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const fogPlane = new THREE.Mesh(fogGeo, fogMat);
  fogPlane.position.z = -5;
  scene.add(fogPlane);

  // ── Resize handler ──
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Animate ──
  let lastTime = 0;
  function animate(time) {
    requestAnimationFrame(animate);

    const t = time * 0.001;
    const delta = t - lastTime;
    lastTime = t;

    // Glitch trigger every 4-8 seconds
    glitchTimer -= delta;
    let glitchVal = 0;
    if (glitchTimer <= 0) {
      glitchTimer = 4 + Math.random() * 8;
      glitchVal = Math.random() > 0.4 ? 1 : 0;
    }

    if (particlesMesh) {
      particlesMesh.material.uniforms.uTime.value      = t;
      particlesMesh.material.uniforms.uGlitch.value    = glitchVal;
      particlesMesh.material.uniforms.uIntensity.value = bgIntensity;

      // Slow rotation
      particlesMesh.rotation.y = t * 0.018;
      particlesMesh.rotation.x = t * 0.009;
    }

    renderer.render(scene, camera);
  }

  animate(0);
}

/** Called from settings slider. val: 0..1 */
export function setBgIntensity(val) {
  bgIntensity = Math.max(0, Math.min(1, val));
}
