/* ============================================================
   GITAVERSE — PAGE TRANSITION LOADER
   Circular loading UI with percentage for page navigation
   ============================================================ */

(function() {
  'use strict';

  // Create the loader overlay
  const overlay = document.createElement('div');
  overlay.id = 'page-loader';
  overlay.innerHTML = `
    <div class="loader-inner">
      <svg class="loader-ring" viewBox="0 0 120 120">
        <circle class="loader-track" cx="60" cy="60" r="52" />
        <circle class="loader-progress" cx="60" cy="60" r="52" />
      </svg>
      <div class="loader-percent">0%</div>
      <div class="loader-label">Loading</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const progressCircle = overlay.querySelector('.loader-progress');
  const percentText = overlay.querySelector('.loader-percent');
  const labelText = overlay.querySelector('.loader-label');

  // Circle circumference for stroke animation
  const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52
  progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

  let currentProgress = 0;
  let targetProgress = 0;
  let animFrame = null;
  let isActive = false;

  function setProgress(pct) {
    targetProgress = Math.min(pct, 100);
  }

  function animateProgress() {
    if (!isActive) return;

    // Ease toward target
    currentProgress += (targetProgress - currentProgress) * 0.12;
    if (Math.abs(currentProgress - targetProgress) < 0.5) {
      currentProgress = targetProgress;
    }

    const offset = CIRCUMFERENCE - (currentProgress / 100) * CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = offset;
    percentText.textContent = `${Math.round(currentProgress)}%`;

    if (currentProgress >= 100) {
      // Complete — fade out and navigate
      setTimeout(() => {
        overlay.classList.add('done');
        setTimeout(() => {
          overlay.classList.remove('active', 'done');
          currentProgress = 0;
          targetProgress = 0;
          isActive = false;
          progressCircle.style.strokeDashoffset = CIRCUMFERENCE;
          percentText.textContent = '0%';
        }, 500);
      }, 200);
      return;
    }

    animFrame = requestAnimationFrame(animateProgress);
  }

  function startLoader(href) {
    isActive = true;
    currentProgress = 0;
    targetProgress = 0;
    overlay.classList.add('active');
    overlay.classList.remove('done');

    // Simulate loading phases
    setProgress(15);
    animFrame = requestAnimationFrame(animateProgress);

    setTimeout(() => setProgress(35), 150);
    setTimeout(() => setProgress(55), 400);
    setTimeout(() => setProgress(75), 700);
    setTimeout(() => setProgress(90), 1000);

    // Navigate after a brief animation
    setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        window.location.href = href;
      }, 400);
    }, 1200);
  }

  // Intercept all navigation links to /verses or /
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');

    // Only intercept cross-page navigation (not anchor links)
    if (href === '/verses' || href === '/') {
      // Don't intercept if already on that page
      const currentPath = window.location.pathname;
      if (
        (href === '/verses' && currentPath === '/verses') ||
        (href === '/' && currentPath === '/')
      ) {
        return;
      }

      e.preventDefault();
      if (isActive) return; // Prevent double-clicks

      labelText.textContent = href === '/verses' ? 'Entering the Gita' : 'Returning Home';
      startLoader(href);
    }
  });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #page-loader {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(8, 8, 16, 0.97);
      backdrop-filter: blur(20px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #page-loader.active {
      opacity: 1;
      pointer-events: all;
    }
    #page-loader.done {
      opacity: 0;
      pointer-events: none;
    }

    .loader-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .loader-ring {
      width: 150px;
      height: 150px;
      transform: rotate(-90deg);
      filter: drop-shadow(0 0 24px rgba(201,168,76,0.35));
    }

    .loader-track {
      fill: none;
      stroke: rgba(255, 255, 255, 0.08);
      stroke-width: 10;
    }

    .loader-progress {
      fill: none;
      stroke: #C9A84C;
      stroke-width: 10;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.1s ease-out;
    }

    .loader-percent {
      font-family: "JetBrains Mono", "SF Mono", monospace;
      font-size: 1.8rem;
      font-weight: 600;
      color: #FAF8F2;
      letter-spacing: 0.05em;
      margin-top: -105px;
    }

    .loader-label {
      font-family: "Inter", sans-serif;
      font-size: 0.8rem;
      color: #8B8FA8;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-top: 50px;
      animation: loaderPulse 2s ease-in-out infinite;
    }

    @keyframes loaderPulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

})();
