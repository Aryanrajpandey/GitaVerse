// ============================================================
// GITAVERSE — ENGAGEMENT MODULE
// Streak tracking, Verse of the Day, Bookmarks, Recently viewed
// ============================================================

// ── Chapter verse counts (for dayOfYear index mapping) ───────
const CHAPTER_VERSE_COUNTS = [47,72,43,42,29,47,30,28,34,42,55,20,34,27,20,24,28,78];
// Cumulative start indices (0-based global verse index)
const CHAPTER_STARTS = (() => {
  const starts = [0];
  for (let i = 0; i < CHAPTER_VERSE_COUNTS.length - 1; i++) {
    starts.push(starts[i] + CHAPTER_VERSE_COUNTS[i]);
  }
  return starts;
})();
const TOTAL_VERSES = CHAPTER_VERSE_COUNTS.reduce((a, b) => a + b, 0); // 700

// Given a 0-based global verse index, returns { chapter, verse }
function globalIndexToChapterVerse(idx) {
  idx = Math.max(0, idx % TOTAL_VERSES);
  let ch = 0;
  while (ch < CHAPTER_STARTS.length - 1 && CHAPTER_STARTS[ch + 1] <= idx) ch++;
  return { chapter: ch + 1, verse: idx - CHAPTER_STARTS[ch] + 1 };
}

// ── Streak ────────────────────────────────────────────────────
export function updateStreak() {
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('gv_lastVisit');
  let streak = parseInt(localStorage.getItem('gv_streak') || '0', 10);

  if (!lastVisit) {
    streak = 1;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastVisit === yesterday.toDateString()) {
      streak = streak + 1;
    } else if (lastVisit !== today) {
      streak = 1;
    }
    // else: same day, no change
  }

  localStorage.setItem('gv_lastVisit', today);
  localStorage.setItem('gv_streak', streak);
  return streak;
}

export function getStreak() {
  return parseInt(localStorage.getItem('gv_streak') || '0', 10);
}

// ── Verse of the Day ──────────────────────────────────────────
export function getVerseOfDayRef() {
  const now  = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return globalIndexToChapterVerse(dayOfYear);
}

// ── Bookmarks ─────────────────────────────────────────────────
export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('gv_bookmarks') || '[]'); }
  catch(_) { return []; }
}

export function isBookmarked(chapter, verse) {
  return getBookmarks().some(b => b.chapter === chapter && b.verse === verse);
}

export function toggleBookmark(chapter, verse) {
  let bm = getBookmarks();
  const idx = bm.findIndex(b => b.chapter === chapter && b.verse === verse);
  if (idx >= 0) {
    bm.splice(idx, 1);
  } else {
    bm.push({ chapter, verse, savedAt: Date.now() });
  }
  localStorage.setItem('gv_bookmarks', JSON.stringify(bm));
  return idx < 0; // true = added, false = removed
}

// ── Recently viewed ───────────────────────────────────────────
export function addRecentlyViewed(chapterNum) {
  let recent = getRecentlyViewed();
  recent = recent.filter(c => c !== chapterNum);
  recent.unshift(chapterNum);
  recent = recent.slice(0, 5);
  localStorage.setItem('gv_recentlyViewed', JSON.stringify(recent));
}

export function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('gv_recentlyViewed') || '[]'); }
  catch(_) { return []; }
}
