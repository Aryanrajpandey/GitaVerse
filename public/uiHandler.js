// ============================================================
// GITAVERSE — UI HANDLER MODULE
// Renders chapter list, verse cards, chapter header, skeletons
// ============================================================
import { setPlayerState, formatTime, play, stopAllAudio, togglePause, getCurrentPlayingVerse } from './audioHandler.js';
import { isBookmarked, toggleBookmark } from './engagement.js';

// ── Chapter list (sidebar) ────────────────────────────────────
export function renderChapterList(chapters, chapterListEl, chaptersLoadingEl, onSelectChapter) {
  chaptersLoadingEl.style.display = 'none';
  chapterListEl.innerHTML = '';

  chapters.forEach((ch, i) => {
    const card = document.createElement('div');
    card.className       = 'chapter-card';
    card.dataset.chapter = ch.chapter_number;
    card.innerHTML = `
      <div class="chapter-card-number">${String(ch.chapter_number).padStart(2, '0')}</div>
      <div class="chapter-card-info">
        <div class="chapter-card-name">${ch.name || ''}</div>
        <div class="chapter-card-translation">${ch.translation || ch.meaning?.en || ''}</div>
        <div class="chapter-card-count">${ch.verses_count} verses</div>
      </div>
    `;
    card.addEventListener('click', () => onSelectChapter(ch.chapter_number));
    card.style.opacity   = '0';
    card.style.transform = 'translateX(-10px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateX(0)';
    }, i * 40);
    chapterListEl.appendChild(card);
  });
}

// ── Dropdown (mobile) ─────────────────────────────────────────
export function renderDropdown(chapters, dropdownMenuEl, onSelectChapter) {
  dropdownMenuEl.innerHTML = '';
  chapters.forEach(ch => {
    const item = document.createElement('div');
    item.className       = 'dropdown-item';
    item.dataset.chapter = ch.chapter_number;
    item.innerHTML = `
      <span class="dropdown-item-num">${String(ch.chapter_number).padStart(2, '0')}</span>
      <div>
        <div class="dropdown-item-name">${ch.name || ''}</div>
        <div class="dropdown-item-en">${ch.translation || ch.meaning?.en || ''}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      onSelectChapter(ch.chapter_number);
      dropdownMenuEl.classList.remove('open');
    });
    dropdownMenuEl.appendChild(item);
  });
}

// ── Chapter header ────────────────────────────────────────────
export function renderChapterHeader(chapter, els) {
  const { badge, verseCount, title, titleEn, summary, headerEl } = els;
  badge.textContent      = `CHAPTER ${chapter.chapter_number}`;
  verseCount.textContent = `${chapter.verses_count} Verses`;
  title.textContent      = chapter.name || '';
  titleEn.textContent    = chapter.translation || chapter.meaning?.en || '';
  summary.textContent    = chapter.summary?.en || '';
  headerEl.style.display = 'block';

  if (typeof gsap !== 'undefined') {
    gsap.from(headerEl, { opacity: 0, y: 20, duration: 0.6, ease: 'power2.out' });
  }
}

// ── Skeleton cards ────────────────────────────────────────────
export function renderSkeletons(count, container) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    sk.innerHTML = `
      <div class="skeleton" style="height: 2rem; width: 40%; margin-bottom: 1.5rem;"></div>
      <div class="skeleton" style="height: 1.2rem; width: 90%;"></div>
      <div class="skeleton" style="height: 1.2rem; width: 85%;"></div>
      <div class="skeleton" style="height: 1.2rem; width: 60%;"></div>
      <div class="skeleton" style="height: 44px; width: 120px; border-radius: 999px; margin-top: 1rem;"></div>
    `;
    fragment.appendChild(sk);
  }
  container.appendChild(fragment);
}

// ── Virtualized Verse List ─────────────────────────────────────
let virtualState = {
  verses: [],
  container: null,
  chapterNum: 0,
  itemHeight: 350, // Average height of a verse card
  buffer: 3,       // Number of items to render above/below viewport
  visibleIndices: { start: 0, end: 0 }
};

export function renderVerses(verses, versesListEl, chapterNum) {
  virtualState = {
    verses,
    container: versesListEl,
    chapterNum,
    itemHeight: 350,
    buffer: 5,
    visibleIndices: { start: -1, end: -1 }
  };

  versesListEl.innerHTML = '';
  // Total height spacer
  const totalHeight = verses.length * virtualState.itemHeight;
  versesListEl.style.height = `${totalHeight}px`;
  versesListEl.style.position = 'relative';

  const scrollParent = versesListEl.parentElement;
  scrollParent.removeEventListener('scroll', handleVirtualScroll);
  scrollParent.addEventListener('scroll', handleVirtualScroll, { passive: true });

  updateVirtualDisplay();

  // Attach event delegation for play buttons ONCE
  if (!versesListEl.dataset.listenersBound) {
    versesListEl.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.audio-play-btn');
      if (playBtn) {
        const verseNum = playBtn.dataset.verse;
        const playing  = getCurrentPlayingVerse();
        if (playing === verseNum) {
          togglePause(verseNum);
        } else {
          stopAllAudio();
          play(verseNum, virtualState.verses);
        }
        return;
      }

      const progressBar = e.target.closest('.audio-progress-bar');
      if (progressBar) {
        // Seeking — handled in audioHandler via currentAudio reference
        return;
      }

      const toggleBtn = e.target.closest('.verse-toggle');
      if (toggleBtn) {
        const section = document.getElementById(`commentaries-${toggleBtn.dataset.verse}`);
        if (!section) return;
        const isOpen  = section.classList.contains('open');
        section.classList.toggle('open');
        toggleBtn.textContent = isOpen ? 'Show Commentaries' : 'Hide Commentaries';
        return;
      }

      const bookmarkBtn = e.target.closest('.verse-bookmark-btn');
      if (bookmarkBtn) {
        const ch    = parseInt(bookmarkBtn.dataset.chapter);
        const verse = parseInt(bookmarkBtn.dataset.verse);
        const added = toggleBookmark(ch, verse);
        bookmarkBtn.classList.toggle('bookmarked', added);
        bookmarkBtn.textContent = added ? '★' : '☆';
        return;
      }
    });

    // Speed change delegation
    versesListEl.addEventListener('change', (e) => {
      if (e.target.classList.contains('audio-speed')) {
        const verseNum = e.target.dataset.verse;
        const playing  = getCurrentPlayingVerse();
        if (playing === verseNum) {
          stopAllAudio();
          play(verseNum, virtualState.verses);
        }
      }
    });
    
    versesListEl.dataset.listenersBound = 'true';
  }
}

function handleVirtualScroll(e) {
  requestAnimationFrame(updateVirtualDisplay);
}

function updateVirtualDisplay() {
  const { verses, container, itemHeight, buffer } = virtualState;
  if (!container) return;

  const scrollParent = container.parentElement;
  const scrollTop    = scrollParent.scrollTop;
  const viewportH    = scrollParent.clientHeight;

  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIdx   = Math.min(verses.length - 1, Math.ceil((scrollTop + viewportH) / itemHeight) + buffer);

  if (startIdx === virtualState.visibleIndices.start && endIdx === virtualState.visibleIndices.end) return;
  virtualState.visibleIndices = { start: startIdx, end: endIdx };

  // Re-render only the range
  const fragment = document.createDocumentFragment();
  for (let i = startIdx; i <= endIdx; i++) {
    const verse = verses[i];
    let card = container.querySelector(`[data-index="${i}"]`);
    
    if (!card) {
      card = document.createElement('div');
      card.className = 'verse-card';
      card.dataset.index = i;
      card.id = `verse-${verse.verse}`;
      card.style.position = 'absolute';
      card.style.top = `${i * itemHeight}px`;
      card.style.width = '100%';
      populateVerseCard(card, verse, virtualState.chapterNum, verses);
      
      // Audio pre-warming
      const text = card.querySelector('.verse-sanskrit')?.innerText || card.querySelector('.slok')?.innerText;
      if (text) import('./apiHandler.js').then(m => m.preloadAudio(text));
    }
    fragment.appendChild(card);
  }

  // Clear nodes outside buffer
  const existingCards = container.querySelectorAll('.verse-card');
  existingCards.forEach(c => {
    const idx = parseInt(c.dataset.index);
    if (idx < startIdx || idx > endIdx) container.removeChild(c);
  });

  container.appendChild(fragment);
}

// (Event listeners were moved inside renderVerses)

// ── Populate a single verse card ──────────────────────────────
function populateVerseCard(card, verse, chapterNum, verses_ref) {
  const commentaries = buildCommentaries(verse);
  const sivananda     = verse.siva;
  const tejomayananda = verse.tej;
  const bookmarked    = isBookmarked(chapterNum, verse.verse);

  card.innerHTML = `
    <div class="verse-header">
      <span class="verse-badge">Verse ${verse.verse}</span>
      <div class="verse-header-actions">
        <button class="verse-bookmark-btn ${bookmarked ? 'bookmarked' : ''}"
          data-chapter="${chapterNum}" data-verse="${verse.verse}"
          title="${bookmarked ? 'Remove bookmark' : 'Bookmark this verse'}"
          aria-label="Bookmark verse ${verse.verse}">
          ${bookmarked ? '★' : '☆'}
        </button>
        ${commentaries ? `<button class="verse-toggle" data-verse="${verse.verse}">Show Commentaries</button>` : ''}
      </div>
    </div>

    <div class="verse-sanskrit">${verse.slok || ''}</div>

    <!-- Audio Player -->
    <div class="verse-audio-player" id="player-${verse.verse}">
      <button class="audio-play-btn" data-verse="${verse.verse}" title="Listen to Sanskrit chanting" aria-label="Play verse ${verse.verse}">
        <svg class="ap-icon-play"    width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        <svg class="ap-icon-pause"   width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="5" y="3" width="5" height="18" rx="1"/><rect x="14" y="3" width="5" height="18" rx="1"/></svg>
        <svg class="ap-icon-loading" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      </button>

      <div class="audio-track">
        <div class="audio-progress-bar" data-verse="${verse.verse}">
          <div class="audio-progress-fill" id="progress-${verse.verse}"></div>
        </div>
        <div class="audio-meta">
          <span class="audio-time" id="time-${verse.verse}">0:00</span>
          <span class="audio-source">संस्कृत · Sanskrit Voice</span>
          <select class="audio-speed" data-verse="${verse.verse}" title="Playback speed" aria-label="Playback speed">
            <option value="0.5">0.5×</option>
            <option value="0.75" selected>0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
          </select>
        </div>
      </div>
    </div>

    <div class="verse-transliteration">${verse.transliteration || ''}</div>

    ${sivananda?.et ? `
      <div class="verse-translation">
        <div class="translation-label">English Translation</div>
        <div class="translation-text">${sivananda.et}</div>
        <div class="translation-author">— ${sivananda.author || 'Swami Sivananda'}</div>
      </div>
    ` : ''}

    ${tejomayananda?.ht ? `
      <div class="verse-translation" style="margin-top:1rem;">
        <div class="translation-label">Hindi Translation</div>
        <div class="translation-text">${tejomayananda.ht}</div>
        <div class="translation-author">— ${tejomayananda.author || 'Swami Tejomayananda'}</div>
      </div>
    ` : ''}

    ${commentaries ? `
      <div class="verse-commentaries" id="commentaries-${verse.verse}">
        ${commentaries}
      </div>
    ` : ''}
  `;
}

// ── Build commentaries HTML ────────────────────────────────────
export function buildCommentaries(verse) {
  const authors = [
    { key: 'purohit', fallbackName: 'Shri Purohit Swami' },
    { key: 'chinmay', fallbackName: 'Swami Chinmayananda' },
    { key: 'san',     fallbackName: 'Dr. S. Sankaranarayan' },
    { key: 'adi',     fallbackName: 'Swami Adidevananda' },
    { key: 'gambir',  fallbackName: 'Swami Gambirananda' },
    { key: 'rams',    fallbackName: 'Swami Ramsukhdas' },
    { key: 'abhinav', fallbackName: 'Sri Abhinav Gupta' },
    { key: 'sankar',  fallbackName: 'Sri Shankaracharya' },
  ];

  let html = ''; let count = 0;
  authors.forEach(({ key, fallbackName }) => {
    const data = verse[key];
    if (!data) return;
    const text = data.et || data.ec || data.sc || data.ht || data.hc;
    if (!text) return;
    count++;
    html += `
      <div class="commentary-section">
        <div class="commentary-author">${data.author || fallbackName}</div>
        <div class="commentary-text">${text}</div>
      </div>
    `;
  });
  return count > 0 ? html : null;
}
