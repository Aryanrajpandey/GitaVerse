// ============================================================
// GITAVERSE — AUDIO HANDLER MODULE
// Manages all audio playback: Web Speech, Server TTS, Ambient
// ============================================================
import { generateAudio, preloadAudio } from './apiHandler.js';

// ── Voice profiles ────────────────────────────────────────────
// Pitch/rate applied to single best voice to emulate gender
const VOICE_PROFILES = {
  male:   { pitch: 0.62, rate: 0.72, volume: 1.0 },
  female: { pitch: 1.38, rate: 0.80, volume: 1.0 },
};

// ── Server-side voice FX (detune + playbackRate for gender) ──
const SERVER_VOICE_FX = {
  male:   { detune: -300, playbackRate: 0.88 },
  female: { detune:  250, playbackRate: 1.05 },
};

// ── State ─────────────────────────────────────────────────────
let currentAudio        = null;
let currentUtterance    = null;
let currentPlayingVerse = null;
let bestVoice           = null;
let useWebSpeech        = false;
let ambientCtx          = null;
let ambientNodes        = null;
const audioCache        = {};            // In-memory audio buffer cache
const inFlightRequests  = new Map();    // Debounce in-flight requests
const playDebounceMap   = new Map();    // 300ms play debounce

// ── Auto-play / repeat flags (from localStorage) ─────────────
let autoPlayNext  = localStorage.getItem('gv_autoplay')  === 'true';
let repeatToggle  = localStorage.getItem('gv_repeat')    === 'true';

// ── Internal state access ─────────────────────────────────────
export function getAutoPlayNext()  { return autoPlayNext; }
export function getRepeatToggle()  { return repeatToggle; }
export function setAutoPlayNext(v) { autoPlayNext = v; localStorage.setItem('gv_autoplay', v); }
export function setRepeatToggle(v) { repeatToggle = v; localStorage.setItem('gv_repeat', v); }
export function getCurrentPlayingVerse() { return currentPlayingVerse; }

// ── Voice mode (internal, defaults to male) ──────────────────
let currentVoiceMode = 'male';
export function setVoiceMode(mode) { currentVoiceMode = mode; }
export function getVoiceMode()     { return currentVoiceMode; }

// ============================================================
// WEB SPEECH INIT
// ============================================================
export function initWebSpeech() {
  if (!('speechSynthesis' in window)) return;

  function pickBestVoice() {
    const all = window.speechSynthesis.getVoices();
    if (!all.length) return;
    const hiIN  = all.filter(v => v.lang === 'hi-IN');
    const hiAny = all.filter(v => v.lang.startsWith('hi'));
    const enIN  = all.filter(v => v.lang === 'en-IN');
    const prefer = (pool) => pool.find(v => !v.localService) || pool[0];
    bestVoice    = prefer(hiIN) || prefer(hiAny) || prefer(enIN) || all[0] || null;
    useWebSpeech = !!bestVoice;
    if (bestVoice) console.log(`[GitaVerse] Voice: "${bestVoice.name}" (${bestVoice.lang})`);
  }

  pickBestVoice();
  window.speechSynthesis.onvoiceschanged = pickBestVoice;
}

// ============================================================
// AMBIENT AUDIO
// ============================================================
export function startAmbient() {
  try {
    if (!ambientCtx) ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (ambientCtx.state === 'suspended') ambientCtx.resume();
    if (ambientNodes) return;

    const ctx = ambientCtx;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
    masterGain.connect(ctx.destination);

    const make = (type, freq, gain) => {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = gain;
      osc.connect(g); g.connect(masterGain); osc.start(); return osc;
    };

    const osc1 = make('sine',     110, 0.60);
    const osc2 = make('sine',     220, 0.25);
    const osc3 = make('triangle', 528, 0.08);
    ambientNodes = { masterGain, osc1, osc2, osc3 };
  } catch (e) {}
}

export function stopAmbient() {
  if (!ambientNodes || !ambientCtx) return;
  ambientNodes.masterGain.gain.linearRampToValueAtTime(0, ambientCtx.currentTime + 1.5);
  setTimeout(() => {
    try { ambientNodes.osc1.stop(); ambientNodes.osc2.stop(); ambientNodes.osc3.stop(); } catch(e) {}
    ambientNodes = null;
  }, 1600);
}

// ============================================================
// PLAYER STATE UI
// ============================================================
export function setPlayerState(verseNum, state) {
  const btn   = document.querySelector(`.audio-play-btn[data-verse="${verseNum}"]`);
  const player = document.getElementById(`player-${verseNum}`);
  if (!btn) return;

  const playI  = btn.querySelector('.ap-icon-play');
  const pauseI = btn.querySelector('.ap-icon-pause');
  const loadI  = btn.querySelector('.ap-icon-loading');
  if (!playI) return;

  playI.style.display  = 'none';
  pauseI.style.display = 'none';
  loadI.style.display  = 'none';
  btn.classList.remove('playing', 'loading');
  if (player) player.classList.remove('playing');

  switch (state) {
    case 'playing':
      pauseI.style.display = 'block';
      btn.classList.add('playing');
      if (player) player.classList.add('playing');
      break;
    case 'loading':
      loadI.style.display = 'block';
      btn.classList.add('loading');
      break;
    case 'paused':
      playI.style.display = 'block';
      btn.classList.add('playing');
      break;
    default:
      playI.style.display = 'block';
      break;
  }
}

// ============================================================
// FORMAT TIME
// ============================================================
export function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// ============================================================
// STOP ALL AUDIO
// ============================================================
export function stopAllAudio() {
  if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); currentUtterance = null; }
  if (currentAudio) {
    try { currentAudio.pause(); } catch(e) {}
    if (currentAudio._ticker) clearInterval(currentAudio._ticker);
    if (currentAudio._ctx)    currentAudio._ctx.close().catch(() => {});
    currentAudio = null;
  }
  stopAmbient();
  if (currentPlayingVerse) {
    setPlayerState(currentPlayingVerse, 'stopped');
    const prevCard = document.getElementById(`verse-${currentPlayingVerse}`);
    if (prevCard) prevCard.classList.remove('chanting');
    const prevProg = document.getElementById(`progress-${currentPlayingVerse}`);
    const prevTime = document.getElementById(`time-${currentPlayingVerse}`);
    if (prevProg) prevProg.style.width = '0%';
    if (prevTime) prevTime.textContent = '0:00';
  }
  currentPlayingVerse = null;
}

// ============================================================
// ON PLAYBACK END
// ============================================================
function onPlaybackEnd(verseNum, card, verses) {
  setPlayerState(verseNum, 'stopped');
  if (card) card.classList.remove('chanting');
  stopAmbient();
  currentPlayingVerse = null;
  currentAudio        = null;
  currentUtterance    = null;

  if (repeatToggle) {
    setTimeout(() => play(verseNum, verses), 600);
    return;
  }
  if (autoPlayNext && verses) {
    const idx = verses.findIndex(v => String(v.verse) === String(verseNum));
    if (idx >= 0 && idx < verses.length - 1) {
      setTimeout(() => play(String(verses[idx + 1].verse), verses), 600);
    }
  }
}

// ============================================================
// PLAY VERSE — public entry point
// ============================================================
export function play(verseNum, verses) {
  // Debounce: ignore rapid duplicate clicks (300ms)
  if (playDebounceMap.has(verseNum)) return;
  playDebounceMap.set(verseNum, setTimeout(() => playDebounceMap.delete(verseNum), 300));

  const card        = document.getElementById(`verse-${verseNum}`);
  const player      = document.getElementById(`player-${verseNum}`);
  if (!card || !player) return;

  const speedSelect  = player.querySelector('.audio-speed');
  const sanskritText = card.querySelector('.verse-sanskrit')?.textContent?.trim() || '';
  if (!sanskritText) return;

  setPlayerState(verseNum, 'loading');
  card.classList.add('chanting');
  currentPlayingVerse = verseNum;

  const speedMult = parseFloat(speedSelect?.value || 0.75);

  // Preload next verse in background
  if (verses) {
    const idx = verses.findIndex(v => String(v.verse) === String(verseNum));
    if (idx >= 0 && idx < verses.length - 1) {
      preloadAudio(verses[idx + 1].slok || '');
    }
  }

  if (useWebSpeech && bestVoice) {
    playWithWebSpeech(verseNum, sanskritText, speedMult, currentVoiceMode, card, player, verses);
  } else {
    playWithServerTTS(verseNum, sanskritText, speedMult, currentVoiceMode, card, speedSelect, verses);
  }
}

// ============================================================
// TOGGLE PAUSE/RESUME
// ============================================================
export function togglePause(verseNum) {
  if (useWebSpeech) {
    if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPlayerState(verseNum, 'playing'); }
    else { window.speechSynthesis.pause(); setPlayerState(verseNum, 'paused'); }
  } else if (currentAudio) {
    if (currentAudio.paused) { currentAudio.play(); setPlayerState(verseNum, 'playing'); }
    else { currentAudio.pause(); setPlayerState(verseNum, 'paused'); }
  }
}

// ============================================================
// WEB SPEECH PLAYBACK
// ============================================================
function playWithWebSpeech(verseNum, text, speedMult, voiceMode, card, player, verses) {
  window.speechSynthesis.cancel();
  const profile = VOICE_PROFILES[voiceMode] || VOICE_PROFILES.male;
  const utter   = new SpeechSynthesisUtterance(text);
  utter.voice   = bestVoice;
  utter.lang    = bestVoice.lang || 'hi-IN';
  utter.pitch   = profile.pitch;
  utter.rate    = Math.min(profile.rate * speedMult, 1.2);
  utter.volume  = profile.volume;

  currentUtterance = utter;
  startAmbient();

  const progressFill     = document.getElementById(`progress-${verseNum}`);
  const timeDisplay      = document.getElementById(`time-${verseNum}`);
  const estimatedDuration = Math.max((text.length / 14) / utter.rate, 3);
  let elapsed = 0;

  const ticker = setInterval(() => {
    elapsed++;
    const pct = Math.min((elapsed / estimatedDuration) * 100, 97);
    if (progressFill) progressFill.style.width = pct + '%';
    if (timeDisplay)  timeDisplay.textContent  = formatTime(elapsed) + ' / ' + formatTime(Math.ceil(estimatedDuration));
  }, 1000);

  utter.onstart = () => setPlayerState(verseNum, 'playing');
  utter.onend   = () => {
    clearInterval(ticker);
    if (progressFill) progressFill.style.width = '0%';
    if (timeDisplay)  timeDisplay.textContent  = '0:00';
    onPlaybackEnd(verseNum, card, verses);
  };
  utter.onerror = (e) => {
    clearInterval(ticker);
    console.warn('[GitaVerse] Web Speech error:', e.error, '— falling back to server TTS');
    onPlaybackEnd(verseNum, card, verses);
    playWithServerTTS(verseNum, text, speedMult, voiceMode, card, player?.querySelector('.audio-speed'), verses);
  };

  const speedSel = player?.querySelector('.audio-speed');
  if (speedSel) speedSel.onchange = () => { stopAllAudio(); play(verseNum, verses); };

  window.speechSynthesis.speak(utter);
}

// ============================================================
// SERVER TTS PLAYBACK (ElevenLabs → Google TTS fallback)
// ============================================================
async function playWithServerTTS(verseNum, text, userSpeed, voice, card, speedSelect, verses) {
  const cacheKey = `${verseNum}_${voice}`;

  // Debounce: if already fetching this verse, skip
  if (inFlightRequests.has(cacheKey)) return;
  inFlightRequests.set(cacheKey, true);

  try {
    let arrayBuffer;
    if (audioCache[cacheKey]) {
      arrayBuffer = audioCache[cacheKey];
    } else {
      try {
        arrayBuffer = await generateAudio(text);
      } catch (err) {
        console.warn('[Audio] /api/generate-audio failed, trying /api/tts fallback:', err.message);
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
        const resp   = await fetch(ttsUrl);
        if (!resp.ok) throw new Error('Both audio sources failed');
        arrayBuffer  = await resp.arrayBuffer();
      }
      audioCache[cacheKey] = arrayBuffer;
    }

    const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const source      = audioCtx.createBufferSource();
    source.buffer     = audioBuffer;

    const fx = SERVER_VOICE_FX[voice] || SERVER_VOICE_FX.male;
    source.detune.value       = fx.detune;
    source.playbackRate.value = fx.playbackRate * userSpeed;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.15);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const progressFill = document.getElementById(`progress-${verseNum}`);
    const timeDisplay  = document.getElementById(`time-${verseNum}`);
    const actualRate   = fx.playbackRate * userSpeed;
    const duration     = audioBuffer.duration / actualRate;
    const startTime    = audioCtx.currentTime;

    const progressTicker = setInterval(() => {
      const elapsed = audioCtx.currentTime - startTime;
      const pct     = Math.min((elapsed / duration) * 100, 99);
      if (progressFill) progressFill.style.width = pct + '%';
      if (timeDisplay)  timeDisplay.textContent  = formatTime(Math.floor(elapsed)) + ' / ' + formatTime(Math.floor(duration));
    }, 250);

    currentAudio = {
      pause:  () => { try { source.stop(); } catch(e) {} },
      paused: false,
      play:   () => {},
      currentTime: 0,
      _source: source,
      _ctx:    audioCtx,
      _ticker: progressTicker,
    };

    if (speedSelect) speedSelect.onchange = () => { stopAllAudio(); play(verseNum, verses); };

    startAmbient();
    setPlayerState(verseNum, 'playing');
    source.start(0);

    source.onended = () => {
      clearInterval(progressTicker);
      if (progressFill) progressFill.style.width = '0%';
      if (timeDisplay)  timeDisplay.textContent  = '0:00';
      audioCtx.close().catch(() => {});
      onPlaybackEnd(verseNum, card, verses);
    };

  } catch (err) {
    console.error('[GitaVerse] Audio playback error:', err);
    setPlayerState(verseNum, 'stopped');
    if (card) card.classList.remove('chanting');
    currentPlayingVerse = null;

    // Show inline error
    const player = document.getElementById(`player-${verseNum}`);
    if (player && !player.querySelector('.audio-error-msg')) {
      const errEl = document.createElement('div');
      errEl.className = 'audio-error-msg';
      errEl.innerHTML = '⚠ Audio unavailable — <button class="retry-audio-btn" style="background:none;border:none;color:inherit;cursor:pointer;text-decoration:underline;">tap to retry</button>';
      errEl.querySelector('.retry-audio-btn').addEventListener('click', () => {
        errEl.remove();
        delete audioCache[cacheKey];
        play(verseNum, verses);
      });
      player.appendChild(errEl);
    }
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
