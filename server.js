// Load .env manually to bypass interceptors that zero out values
(function loadEnv() {
  const fs   = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/\s+#.*$/, '').trim();
    if (key && val) {
      process.env[key] = val;
      if (key === 'GV_ELEVENLABS_API_KEY') process.env.ELEVENLABS_API_KEY = val;
    }
  }
})();


const express = require('express');
const path    = require('path');
const zlib    = require('zlib');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// AUDIO CACHE DIRECTORY
// ============================================================
const AUDIO_CACHE_DIR = path.join(__dirname, 'audio-cache');
if (!fs.existsSync(AUDIO_CACHE_DIR)) fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

// ============================================================
// SITUATION MAP — hardcoded, no AI needed
// ============================================================
const SITUATION_MAP = {
  stress:     [{ chapter: 2, verse: 47 }, { chapter: 6, verse: 5  }],
  confusion:  [{ chapter: 2, verse: 7  }, { chapter: 3, verse: 35 }],
  anger:      [{ chapter: 2, verse: 63 }, { chapter: 16, verse: 1 }],
  motivation: [{ chapter: 3, verse: 8  }, { chapter: 18, verse: 48}],
  grief:      [{ chapter: 2, verse: 20 }, { chapter: 2, verse: 13 }],
  fear:       [{ chapter: 4, verse: 10 }, { chapter: 18, verse: 66}],
};

// ============================================================
// GZIP COMPRESSION (reduces transfer size 60-80%)
// ============================================================
app.use((req, res, next) => {
  const ae = req.headers['accept-encoding'] || '';
  if (!ae.includes('gzip')) return next();

  const origWrite = res.write.bind(res);
  const origEnd   = res.end.bind(res);
  const gz = zlib.createGzip({ level: 6 });

  res.set('Content-Encoding', 'gzip');
  res.write = (chunk) => { gz.write(chunk); return true; };
  res.end   = (chunk) => {
    if (chunk) gz.write(chunk);
    gz.end();
  };
  gz.on('data', (chunk) => origWrite(chunk));
  gz.on('end',  ()      => origEnd());
  next();
});

// ============================================================
// BODY PARSING
// ============================================================
app.use(express.json({ limit: '50kb' }));

// ============================================================
// IN-MEMORY CACHE
// ============================================================
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================================
// DATA MANAGEMENT — Production-Grade LRU Persistence
// ============================================================
const PERSISTENT_CACHE_FILE = path.join(__dirname, 'data', 'verses_cache.json');
const MAX_CACHE_ITEMS = 5000; // Prevent memory bloat
let persistentCache = {};
let cacheKeys = []; // Track insertion order for LRU
let isSaving = false;

// Load persistent cache on startup
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
  if (fs.existsSync(PERSISTENT_CACHE_FILE)) {
    persistentCache = JSON.parse(fs.readFileSync(PERSISTENT_CACHE_FILE, 'utf8'));
    cacheKeys = Object.keys(persistentCache);
    console.log(`\x1b[36m[Data]\x1b[0m Ready with ${cacheKeys.length} items.`);
  }
} catch (e) { console.error('[Data] Load failed:', e.message); }

function scheduleSave() {
  if (isSaving) return;
  isSaving = true;
  setTimeout(() => {
    try {
      fs.writeFileSync(PERSISTENT_CACHE_FILE, JSON.stringify(persistentCache));
      isSaving = false;
    } catch (e) { isSaving = false; }
  }, 10000); // 10s debounce for production stability
}

const VEDIC_API_BASE = 'https://vedicscriptures.github.io';

async function fetchFromVedicAPI(endpoint) {
  const cacheKey = `vedic:${endpoint}`;
  
  if (persistentCache[cacheKey]) {
    // Move to end of keys (LRU)
    cacheKeys = cacheKeys.filter(k => k !== cacheKey);
    cacheKeys.push(cacheKey);
    return persistentCache[cacheKey];
  }

  const response = await fetch(`${VEDIC_API_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
  const data = await response.json();
  
  // LRU Eviction
  if (cacheKeys.length >= MAX_CACHE_ITEMS) {
    const oldest = cacheKeys.shift();
    delete persistentCache[oldest];
  }
  
  persistentCache[cacheKey] = data;
  cacheKeys.push(cacheKey);
  scheduleSave();
  return data;
}

/**
 * Slim down verse data to only what the UI needs
 */
function slimVerse(v) {
  return {
    verse:           v.verse,
    slok:            v.slok,
    transliteration: v.transliteration,
    siva: { et: v.siva?.et, author: v.siva?.author },
    tej:  { ht: v.tej?.ht, author: v.tej?.author },
    // Keep a few other key commentaries if present
    rams: v.rams ? { ht: v.rams.ht, author: v.rams.author } : null,
    adi:  v.adi ? { et: v.adi.et, author: v.adi.author } : null,
  };
}

// ============================================================
// STATIC ASSETS — Production Edge Optimization
// ============================================================
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d', // 1 week browser cache
  etag: true,   // Strong validation
  lastModified: true,
  setHeaders: (res, path) => {
    // 1. Core JS/CSS (Immutable if versioned, but here we use strong etags)
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // Revalidate JS/CSS on every request
    }
    // 2. Fonts/Images (High priority cache)
    if (/\.(woff2|png|jpg|webp|svg)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // 3. Security
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// ============================================================
// API ROUTES — Vedic Scriptures
// ============================================================

/** GET /api/chapters */
app.get('/api/chapters', async (req, res) => {
  try {
    const chapters = await fetchFromVedicAPI('/chapters');
    res.json(chapters);
  } catch (err) {
    console.error('Error fetching chapters:', err.message);
    res.status(502).json({ error: 'Failed to fetch chapters from upstream API.' });
  }
});

/** GET /api/chapter/:ch */
app.get('/api/chapter/:ch', async (req, res) => {
  const ch = parseInt(req.params.ch);
  if (isNaN(ch) || ch < 1 || ch > 18) return res.status(400).json({ error: 'Chapter must be between 1 and 18.' });
  try {
    const chapter = await fetchFromVedicAPI(`/chapter/${ch}`);
    res.json(chapter);
  } catch (err) {
    console.error(`Error fetching chapter ${ch}:`, err.message);
    res.status(502).json({ error: `Failed to fetch chapter ${ch}.` });
  }
});

/** 
 * GET /api/verses/:ch — Optimized with pagination and slim payloads 
 * Query Params: ?offset=0&limit=10
 */
app.get('/api/verses/:ch', async (req, res) => {
  const ch     = parseInt(req.params.ch);
  const offset = parseInt(req.query.offset) || 0;
  const limit  = parseInt(req.query.limit)  || 100; // Default to all if not specified, but UI can use pagination
  
  if (isNaN(ch) || ch < 1 || ch > 18) return res.status(400).json({ error: 'Chapter 1-18 only.' });

  console.log(`[API] Fetching verses for Chapter ${ch} (offset: ${offset}, limit: ${limit})`);

  try {
    // 1. Fetch chapter info (for verse count)
    const chapterData = await fetchFromVedicAPI(`/chapter/${ch}`);
    const verseCount  = chapterData.verses_count;
    
    // 2. Determine range
    const start = offset + 1;
    const end   = Math.min(offset + limit, verseCount);
    
    // 3. Fetch verses in batches (hit cache or external, avoid rate limiting)
    const rawVerses = [];
    const batchSize = 15;
    for (let i = start; i <= end; i += batchSize) {
      const batch = [];
      for (let j = i; j < i + batchSize && j <= end; j++) {
        batch.push(fetchFromVedicAPI(`/slok/${ch}/${j}`));
      }
      const results = await Promise.all(batch);
      rawVerses.push(...results);
    }
    
    // 4. Slim down the data (Performance!)
    const verses = rawVerses.map(slimVerse);
    
    console.log(`[API] Successfully retrieved ${verses.length} verses for Chapter ${ch}`);

    res.json({
      chapter: {
        chapter_number: chapterData.chapter_number,
        name:           chapterData.name,
        translation:    chapterData.translation,
        summary:        chapterData.summary,
        verses_count:   chapterData.verses_count
      },
      verses,
      pagination: { total: verseCount, offset, limit, count: verses.length }
    });
  } catch (err) {
    console.error(`[API] Verse load failed for Ch ${ch}:`, err.message);
    res.status(502).json({ error: 'Data fetch failed.' });
  }
});

/** GET /api/verse/:ch/:verse */
app.get('/api/verse/:ch/:verse', async (req, res) => {
  const ch    = parseInt(req.params.ch);
  const verse = parseInt(req.params.verse);
  if (isNaN(ch) || ch < 1 || ch > 18) return res.status(400).json({ error: 'Chapter must be between 1 and 18.' });
  if (isNaN(verse) || verse < 1)       return res.status(400).json({ error: 'Verse must be a positive number.' });
  try {
    const slok = await fetchFromVedicAPI(`/slok/${ch}/${verse}`);
    res.json(slok);
  } catch (err) {
    console.error(`Error fetching verse ${ch}:${verse}:`, err.message);
    res.status(502).json({ error: `Failed to fetch verse ${ch}:${verse}.` });
  }
});

// ============================================================
// TTS PROXY — Google Translate fallback
// ============================================================
app.get('/api/tts', async (req, res) => {
  const text  = req.query.text;
  const voice = req.query.voice || 'male';
  if (!text || text.length > 600) return res.status(400).json({ error: 'Text is required and must be under 600 characters.' });

  const speedMap = { male: '0.42', female: '0.54' };
  const speed = speedMap[voice] || speedMap.male;
  const lang = 'hi';
  const encodedText = encodeURIComponent(text);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob&ttsspeed=${speed}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Referer':    'https://translate.google.com/',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  };

  async function fetchTTS(retries = 1) {
    const response = await fetch(ttsUrl, { headers });
    if (response.status === 429 && retries > 0) {
      await new Promise(r => setTimeout(r, 900));
      return fetchTTS(retries - 1);
    }
    if (!response.ok) throw new Error(`TTS upstream error: ${response.status}`);
    return response;
  }

  try {
    const response = await fetchTTS();
    res.set({
      'Content-Type':  'audio/mpeg',
      'Cache-Control': 'public, max-age=604800',
      'X-Voice': voice,
      'X-Lang':  lang,
      'X-Speed': speed,
      'Vary':    'Accept-Encoding',
    });
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(502).json({ error: 'Failed to generate audio. Please try again.' });
  }
});

// ============================================================
// ELEVENLABS TTS — POST /api/generate-audio
// Disk-caches responses. Falls back to Google TTS on failure.
// ============================================================
app.post('/api/generate-audio', async (req, res) => {
  const { text, voiceId } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 800) {
    return res.status(400).json({ error: 'text is required and must be under 800 characters.' });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const VOICE_ID = voiceId || process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB';

  // Disk cache key = SHA-256 of text + voiceId
  const cacheHash = crypto.createHash('sha256').update(`${VOICE_ID}:${text}`).digest('hex');
  const cachePath = path.join(AUDIO_CACHE_DIR, `${cacheHash}.mp3`);

  // Cache hit: serve file directly
  if (fs.existsSync(cachePath)) {
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=2592000');
    res.set('X-Audio-Source', 'disk-cache');
    return res.sendFile(cachePath);
  }

  // Try ElevenLabs if key is available
  if (ELEVENLABS_API_KEY) {
    try {
      const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
        method: 'POST',
        headers: {
          'xi-api-key':   ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':        'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true }
        }),
      });

      if (elResponse.status === 429) {
        console.warn('[ElevenLabs] Quota exceeded — falling back to Google TTS');
        // fall through to Google TTS below
      } else if (elResponse.ok) {
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        // Write to disk cache asynchronously
        fs.writeFile(cachePath, audioBuffer, (err) => { if (err) console.error('Cache write error:', err); });
        res.set('Content-Type', 'audio/mpeg');
        res.set('Cache-Control', 'public, max-age=2592000');
        res.set('X-Audio-Source', 'elevenlabs');
        return res.send(audioBuffer);
      } else {
        const errBody = await elResponse.text().catch(() => '');
        console.warn(`[ElevenLabs] Error ${elResponse.status}: ${errBody}`);
        // fall through to Google TTS
      }
    } catch (err) {
      console.warn('[ElevenLabs] Request failed:', err.message, '— falling back to Google TTS');
    }
  }

  // ── Google Translate TTS fallback ───────────────────────────
  try {
    const speed = '0.42';
    const lang = 'hi';
    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob&ttsspeed=${speed}`;
    const gtResponse = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      }
    });
    if (!gtResponse.ok) throw new Error(`Google TTS error: ${gtResponse.status}`);
    const audioBuffer = Buffer.from(await gtResponse.arrayBuffer());
    // Cache Google result too
    fs.writeFile(cachePath, audioBuffer, (err) => { if (err) console.error('Cache write error:', err); });
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=604800');
    res.set('X-Audio-Source', 'google-tts');
    return res.send(audioBuffer);
  } catch (err) {
    console.error('[Audio] All TTS sources failed:', err.message);
    res.status(502).json({ error: 'Audio generation failed. Please try again.' });
  }
});

// ============================================================
// SAARATHI AI — POST /api/saarathi
// Simulated local response for demo mode.
// ============================================================
app.post('/api/saarathi', async (req, res) => {
  const { question, verseContext, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.length > 2000) {
    return res.status(400).json({ error: 'question is required and must be under 2000 characters.' });
  }

  // Simulated structured response
  return res.json({
    explanation: 'The Gita teaches that action performed without attachment to its fruits is the highest form of duty. This principle, Nishkama Karma, is the heart of Chapter 3.',
    application: 'When facing a difficult decision today, focus on what the right action is — not what you will gain from it.',
    relatedVerse: { chapter: 3, verse: 19, reason: 'Krishna explains the practice of desireless action directly.' }
  });
});

// ============================================================
// SITUATION MAP — GET /api/situation/:type
// Returns verse data for the given life situation.
// ============================================================
app.get('/api/situation/:type', async (req, res) => {
  const type = req.params.type.toLowerCase();
  const refs = SITUATION_MAP[type];
  if (!refs) return res.status(400).json({ error: `Unknown situation type: ${type}. Valid: ${Object.keys(SITUATION_MAP).join(', ')}` });

  try {
    const verses = await Promise.all(
      refs.map(async ({ chapter, verse }) => {
        const data = await fetchFromVedicAPI(`/slok/${chapter}/${verse}`);
        return { chapter, verse, ...data };
      })
    );
    res.json({ situation: type, verses });
  } catch (err) {
    console.error(`[Situation] Error for type ${type}:`, err.message);
    res.status(502).json({ error: 'Failed to fetch situation verses.' });
  }
});

// ============================================================
// SPA FALLBACK — serve verses.html for /verses route
// ============================================================
app.get('/verses', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verses.html'));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   ✦  GitaVerse Server Running  ✦         ║
  ║                                          ║
  ║   Local:  http://localhost:${PORT}          ║
  ║   ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✓ Configured' : '○ Not set (using Google TTS)'}
  ║   Saarathi:   ○ Simulated (Local Demo Mode)
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);
});
