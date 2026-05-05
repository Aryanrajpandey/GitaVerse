// ============================================================
// GITAVERSE — NAVIGATION HANDLER (SPA)
// Instant page transitions without reloads.
// ============================================================

import { fetchChapters } from './apiHandler.js';

// Intercept hash navigation for SPA feel
window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash.startsWith('#chapter/')) {
    const chNum = parseInt(hash.replace('#chapter/', ''));
    if (!isNaN(chNum)) {
      // Predictive loading: prefetch next chapter on idle
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          import('./apiHandler.js').then(m => m.prefetchVerses(chNum + 1));
        });
      }
    }
  }
});

const viewContainer = document.getElementById('view-container');
const pageLoader    = document.getElementById('page-loader');

/**
 * Transition to a new URL without reloading
 */
export async function navigate(url, pushState = true) {
  if (url === window.location.pathname) return;

  // 1. Start fade out
  viewContainer.classList.add('view-hidden');
  if (pageLoader) pageLoader.style.transform = 'scaleX(1)';

  try {
    // 2. Fetch new page content
    const response = await fetch(url);
    if (!response.ok) throw new Error('Navigation failed');
    const html = await response.text();

    // 3. Parse and swap content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.getElementById('view-container') || doc.body;

    // Wait for fade out to finish (approx 300ms)
    await new Promise(r => setTimeout(r, 150));

    // Swap
    viewContainer.innerHTML = newContent.innerHTML;
    document.title = doc.title;

    // 4. Update History
    if (pushState) {
      window.history.pushState({ url }, doc.title, url);
    }

    // 5. Re-initialize scripts
    initViewScripts(url);

    // 6. Fade in
    window.scrollTo(0, 0);
    viewContainer.classList.remove('view-hidden');
    if (pageLoader) {
      pageLoader.style.transformOrigin = 'right';
      pageLoader.style.transform = 'scaleX(0)';
      setTimeout(() => { pageLoader.style.transformOrigin = 'left'; }, 400);
    }
  } catch (err) {
    console.error('SPA Navigation Error:', err);
    window.location.href = url; // Fallback to full reload
  }
}

/**
 * Identify and run logic for the specific view
 */
function initViewScripts(url) {
  const path = url.split('#')[0].split('?')[0];
  
  if (path.includes('verses')) {
    // Load verses module dynamically
    import('./verses.js').then(m => {
      if (m.init) m.init();
    });
  } else {
    // Home page logic (usually in script.js)
    if (window.initHome) window.initHome();
  }
}

// ── Event Listeners ──────────────────────────────────────────

// Intercept all local links
document.addEventListener('click', e => {
  const link = e.target.closest('a');
  if (!link) return;

  const url = new URL(link.href);
  if (url.origin === window.location.origin) {
    // Check if it's an anchor on the same page
    if (url.pathname === window.location.pathname && url.hash) return;

    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }
});

// Handle browser back/forward
window.addEventListener('popstate', e => {
  if (e.state && e.state.url) {
    navigate(e.state.url, false);
  } else {
    navigate(window.location.pathname, false);
  }
});

// Initial load prefetching
document.addEventListener('mouseover', e => {
  const link = e.target.closest('a');
  if (!link) return;
  const url = new URL(link.href);
  
  if (url.pathname.includes('verses')) {
    // 1. Pre-fetch chapters list
    fetchChapters();

    // 2. If it's a specific chapter link (e.g. #chapter/1), prefetch that chapter's verses
    const match = url.hash.match(/chapter\/(\d+)/);
    if (match) {
      import('./apiHandler.js').then(m => m.prefetchVerses(match[1]));
    }
  }
});
// Bootstrap initial view on load
initViewScripts(window.location.pathname);
