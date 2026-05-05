// ============================================================
// GITAVERSE — API HANDLER MODULE
// All server communication. In-memory TTL cache.
// ============================================================

const API_CACHE = new Map();
const MAX_FRONTEND_CACHE = 50; // Max chapters to keep in memory
const CACHE_TTL_SHORT = 5  * 60 * 1000;
const CACHE_TTL_LONG  = 24 * 60 * 60 * 1000;

function apiGet(key) {
  const e = API_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) { API_CACHE.delete(key); return null; }
  
  // LRU: Move to end
  API_CACHE.delete(key);
  API_CACHE.set(key, e);
  return e.data;
}

function apiSet(key, data, ttl) {
  if (API_CACHE.size >= MAX_FRONTEND_CACHE) {
    const oldestKey = API_CACHE.keys().next().value;
    API_CACHE.delete(oldestKey);
  }
  API_CACHE.set(key, { data, ts: Date.now(), ttl });
}

// ── Generic fetch with timeout ─────────────────────────────
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 120)}`);
    }
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ── Chapter endpoints ────────────────────────────────────────
export async function fetchChapters() {
  const key = 'chapters';
  const cached = apiGet(key);
  if (cached) return cached;

  const res = await apiFetch('/api/chapters');
  const data = await res.json();
  apiSet(key, data, CACHE_TTL_LONG);
  return data;
}

export async function fetchVerses(chNum, offset = 0, limit = 100) {
  const key = `verses:${chNum}:${offset}:${limit}`;
  const cached = apiGet(key);
  if (cached) return cached;

  const res = await apiFetch(`/api/verses/${chNum}?offset=${offset}&limit=${limit}`);
  const data = await res.json();
  apiSet(key, data, CACHE_TTL_SHORT);
  return data;
}

export async function fetchVerse(ch, verse) {
  const key = `verse:${ch}:${verse}`;
  const cached = apiGet(key);
  if (cached) return cached;

  const res = await apiFetch(`/api/verse/${ch}/${verse}`);
  const data = await res.json();
  apiSet(key, data, CACHE_TTL_LONG);
  return data;
}

// ── Audio generation ─────────────────────────────────────────
export async function generateAudio(text, voiceId) {
  const body = { text };
  if (voiceId) body.voiceId = voiceId;

  const res = await apiFetch('/api/generate-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    priority: 'high',
  });
  return res.arrayBuffer();
}

// Preload (fire-and-forget, low priority)
export function preloadAudio(text) {
  if (!text) return;
  fetch('/api/generate-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    priority: 'low',
  }).catch(() => {}); // silent
}

// ── Saarathi AI ──────────────────────────────────────────────
export async function askSaarathi(question, verseContext, history) {
  const res = await apiFetch('/api/saarathi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, verseContext, history }),
  });
  return res.json();
}

// ── Situation mapping ─────────────────────────────────────────
export async function fetchSituation(type) {
  const key = `situation:${type}`;
  const cached = apiGet(key);
  if (cached) return cached;

  const res = await apiFetch(`/api/situation/${type}`);
  const data = await res.json();
  apiSet(key, data, CACHE_TTL_LONG);
  return data;
}

/**
 * Low-priority prefetch (fire and forget)
 */
export function prefetchVerses(chNum) {
  const key = `verses:${chNum}`;
  if (API_CACHE.has(key)) return;
  
  fetch(`/api/verses/${chNum}`, { priority: 'low' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data) apiSet(key, data, CACHE_TTL_SHORT);
    }).catch(() => {});
}
