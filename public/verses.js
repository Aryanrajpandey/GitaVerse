// ============================================================
// GITAVERSE — VERSES PAGE ORCHESTRATOR
// ============================================================

import { fetchChapters, fetchVerses } from './apiHandler.js';
import {
  initWebSpeech, startAmbient, stopAllAudio,
  setPlayerState, play, getAutoPlayNext, getRepeatToggle, setAutoPlayNext, setRepeatToggle,
} from './audioHandler.js';
import {
  renderChapterList, renderChapterHeader,
  renderSkeletons, renderVerses,
} from './uiHandler.js';
import {
  updateStreak, addRecentlyViewed, getStreak
} from './engagement.js';

let chapters        = [];
let currentChapter  = null;
let lastRetryAction = null;
let isEventsBound   = false;

/**
 * Main Initialization
 */
export async function init() {
  const dom = queryDOM();
  if (!dom.chapterList) return;

  initWebSpeech();
  updateStreak();
  showStreakBadge(dom.streakBadge);

  // Setup Event Listeners (only if not already bound globally)
  if (!isEventsBound) {
    window.addEventListener('hashchange', handleHashNavigation);
    setupGlobalEvents();
    isEventsBound = true;
  }

  // Setup View-Specific Listeners (fresh in DOM)
  setupViewListeners(dom);

  // Initial Load
  try {
    chapters = await fetchChapters();
    if (dom.chaptersLoading) dom.chaptersLoading.style.display = 'none';
    
    renderChapterList(chapters, dom.chapterList, dom.chaptersLoading, selectChapter);
    
    handleHashNavigation();
  } catch (err) {
    console.error('Initial chapters load failed:', err);
    if (dom.chaptersLoading) {
      dom.chaptersLoading.innerHTML = `<span style="color:var(--accent); cursor:pointer" onclick="location.reload()">⚠️ Failed to load. Tap to retry.</span>`;
    }
  }
}

/**
 * Re-query all DOM elements (needed for SPA swaps)
 */
function queryDOM() {
  return {
    chapterList:      document.getElementById('chapter-list'),
    chaptersLoading:  document.getElementById('chapters-loading'),
    welcomeState:     document.getElementById('welcome-state'),
    chapterHeader:    document.getElementById('chapter-header'),
    versesList:       document.getElementById('verses-list'),
    versesLoading:    document.getElementById('verses-loading'),
    versesContent:    document.getElementById('verses-content'),
    errorState:       document.getElementById('error-state'),
    errorMessage:     document.getElementById('error-message'),
    retryBtn:         document.getElementById('retry-btn'),
    meditationToggle: document.getElementById('meditation-toggle'),
    autoPlayBtn:      document.getElementById('autoplay-toggle'),
    repeatBtn:        document.getElementById('repeat-toggle'),
    bookmarksBtn:     document.getElementById('bookmarks-filter'),
    streakBadge:      document.getElementById('streak-badge'),
    chNumberBadge:    document.getElementById('ch-number-badge'),
    chVerseCount:     document.getElementById('ch-verse-count'),
    chTitle:          document.getElementById('ch-title'),
    chTitleEn:        document.getElementById('ch-title-en'),
    chSummary:        document.getElementById('ch-summary'),
  };
}

let activeRequestId = 0;

/**
 * Logic for chapter selection
 */
async function selectChapter(chNum, force = false) {
  if (currentChapter === chNum && !force) return;
  currentChapter = chNum;
  window.location.hash = `chapter/${chNum}`;
  
  const requestId = ++activeRequestId;
  const dom = queryDOM();
  
  stopAllAudio();
  addRecentlyViewed(chNum);

  // 1. Instant UI Feedback
  if (dom.welcomeState)   dom.welcomeState.style.display = 'none';
  if (dom.chapterHeader)  dom.chapterHeader.style.display = 'none';
  if (dom.errorState)     dom.errorState.style.display = 'none';
  if (dom.versesLoading)  dom.versesLoading.style.display = 'flex';
  if (dom.versesList) {
    dom.versesList.innerHTML = '';
    renderSkeletons(5, dom.versesList);
  }

  try {
    console.log(`[Verses] Fetching data for chapter ${chNum}...`);
    const data = await fetchVerses(chNum);
    console.log(`[Verses] Received data for chapter ${chNum}:`, data);
    
    // Check if this request is still relevant (user hasn't switched away)
    if (requestId !== activeRequestId) {
      console.log(`[Verses] Request ID ${requestId} aborted, active is ${activeRequestId}`);
      return;
    }

    if (dom.versesLoading) dom.versesLoading.style.display = 'none';
    
    if (!data || !data.verses) {
      throw new Error("Invalid data format received from backend");
    }

    renderChapterHeader(data.chapter, {
      badge: dom.chNumberBadge, verseCount: dom.chVerseCount,
      title: dom.chTitle, titleEn: dom.chTitleEn, summary: dom.chSummary,
      headerEl: dom.chapterHeader,
    });
    
    renderVerses(data.verses, dom.versesList, chNum, data.verses);
    dom.versesContent?.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error(`[Verses] Error loading chapter ${chNum}:`, err);
    if (requestId !== activeRequestId) return;
    if (dom.versesLoading) dom.versesLoading.style.display = 'none';
    if (dom.errorState) dom.errorState.style.display = 'flex';
    currentChapter = null; // Allow user to tap the same chapter again to retry
    lastRetryAction = () => selectChapter(chNum, true);
  }
}

function handleHashNavigation() {
  const hash = window.location.hash;
  if (!hash) return;
  const match = hash.match(/^#chapter\/(\d+)/);
  if (match) {
    const chNum = parseInt(match[1], 10);
    if (chNum !== currentChapter && chapters.length > 0) {
      selectChapter(chNum);
    }
  }
}

function showStreakBadge(badge) {
  const streak = getStreak();
  if (streak >= 2 && badge) {
    badge.textContent = `🔥 ${streak} days`;
    badge.style.display = 'flex';
  }
}

function setupViewListeners(dom) {
  dom.meditationToggle?.addEventListener('click', () => {
    document.body.classList.toggle('meditation-mode');
  });

  dom.autoPlayBtn?.addEventListener('click', () => {
    const val = !getAutoPlayNext();
    setAutoPlayNext(val);
    dom.autoPlayBtn.classList.toggle('active', val);
  });

  dom.repeatBtn?.addEventListener('click', () => {
    const val = !getRepeatToggle();
    setRepeatToggle(val);
    dom.repeatBtn.classList.toggle('active', val);
  });

  dom.retryBtn?.addEventListener('click', () => {
    if (lastRetryAction) lastRetryAction();
  });
}

function setupGlobalEvents() {
  document.addEventListener('click', async e => {
    const playBtn = e.target.closest('.play-btn');
    if (!playBtn) return;

    const card = playBtn.closest('.verse-card');
    const ch   = card.dataset.chapter;
    const v    = card.dataset.verse;
    const text = card.querySelector('.slok').innerText;

    stopAllAudio();
    startAmbient();
    setPlayerState(card, true);
    await play(text, ch, v);
    setPlayerState(card, false);
  });
}

// Exported for SPA orchestration
