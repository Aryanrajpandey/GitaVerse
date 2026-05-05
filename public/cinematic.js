/* ============================================================
   GITAVERSE — CINEMATIC BACKGROUND
   Full-page Three.js particle/wireframe animation 
   Shared across all pages
   ============================================================ */

(function () {
  'use strict';

  if (typeof THREE === 'undefined') return;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'cinematic-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  // Inject style
  const style = document.createElement('style');
  style.textContent = `
    #cinematic-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 2s ease;
    }
    #cinematic-bg.visible {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Cap pixel ratio at 1.5 — avoids 4× fill rate cost on retina/HiDPI
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // ---- Central wireframe icosahedron ----
  const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0xC9A84C,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  const icosphere = new THREE.Mesh(icoGeo, icoMat);
  scene.add(icosphere);

  // Fewer particles on mobile — major GPU savings
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 80 : 320;
  const particlesGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    // Spread particles across a wide area
    positions[i3]     = (Math.random() - 0.5) * 30;
    positions[i3 + 1] = (Math.random() - 0.5) * 30;
    positions[i3 + 2] = (Math.random() - 0.5) * 20 - 2;
    // Slow random drift
    velocities[i3]     = (Math.random() - 0.5) * 0.003;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.003;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.001;
    // Random sizes
    sizes[i] = Math.random() * 2.5 + 0.5;
  }

  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Custom particle texture — soft glow circle
  const particleCanvas = document.createElement('canvas');
  particleCanvas.width = 64;
  particleCanvas.height = 64;
  const pCtx = particleCanvas.getContext('2d');
  const gradient = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(201,168,76,1)');
  gradient.addColorStop(0.3, 'rgba(201,168,76,0.4)');
  gradient.addColorStop(1, 'rgba(201,168,76,0)');
  pCtx.fillStyle = gradient;
  pCtx.fillRect(0, 0, 64, 64);

  const particleTexture = new THREE.CanvasTexture(particleCanvas);

  const particlesMat = new THREE.PointsMaterial({
    map: particleTexture,
    size: 0.12,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    color: 0xC9A84C,
  });

  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  // ---- Outer ring (orbit) ----
  const ringGeo = new THREE.RingGeometry(3.5, 3.55, 80);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xC9A84C,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI * 0.55;
  scene.add(ring);

  // Second ring at different angle
  const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
  ring2.rotation.x = Math.PI * 0.35;
  ring2.rotation.y = Math.PI * 0.3;
  ring2.material.opacity = 0.05;
  scene.add(ring2);

  // ---- Mouse tracking (passive) ----
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // ---- Scroll-based parallax ----
  let scrollProgress = 0;
  window.addEventListener('scroll', () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  }, { passive: true });

  // ---- Animation loop ----
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Icosphere rotation
    icosphere.rotation.x += 0.0015;
    icosphere.rotation.y += 0.002;

    // Subtle scroll-based transform on icosphere
    icosphere.position.y = -scrollProgress * 2;
    icosphere.material.opacity = 0.18 - scrollProgress * 0.08;

    // Ring rotation
    ring.rotation.z = elapsed * 0.08;
    ring2.rotation.z = -elapsed * 0.05;

    // Camera follow mouse
    camera.position.x += (mouseX * 0.4 - camera.position.x) * 0.03;
    camera.position.y += (-mouseY * 0.4 - camera.position.y) * 0.03;
    camera.lookAt(scene.position);

    // Animate particles
    const posArr = particlesGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArr[i3]     += velocities[i3];
      posArr[i3 + 1] += velocities[i3 + 1];
      posArr[i3 + 2] += velocities[i3 + 2];

      // Wrap around boundaries
      if (posArr[i3] > 15) posArr[i3] = -15;
      if (posArr[i3] < -15) posArr[i3] = 15;
      if (posArr[i3 + 1] > 15) posArr[i3 + 1] = -15;
      if (posArr[i3 + 1] < -15) posArr[i3 + 1] = 15;
    }
    particlesGeo.attributes.position.needsUpdate = true;

    // Gentle breathing of particles
    particlesMat.opacity = 0.4 + Math.sin(elapsed * 0.5) * 0.15;

    renderer.render(scene, camera);
  }

  animate();

  // Resize handler — debounced (only fires 150ms after last resize)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 150);
  }, { passive: true });

  // Fade in after short delay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.classList.add('visible');
    });
  });

})();
