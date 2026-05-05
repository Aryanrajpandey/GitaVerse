window.initHome = function() {
  const navbar = document.getElementById('navbar');
  const hero   = document.getElementById('hero');
  if (!hero) return; // Not on home page

  // Re-run animations and observers
  const observer = new IntersectionObserver(([entry]) => {
    if (navbar) navbar.classList.toggle('scrolled', !entry.isIntersecting);
  }, { threshold: 0.1 });
  observer.observe(hero);

  // Mobile menu logic (re-bind since DOM might be new)
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileClose = document.getElementById('mobile-close');
  if (hamburger && mobileMenu && mobileClose) {
    hamburger.addEventListener('click', () => mobileMenu.classList.add('open'));
    mobileClose.addEventListener('click', () => mobileMenu.classList.remove('open'));
  }

  // Refresh GSAP ScrollTriggers
  ScrollTrigger.refresh();
};

// Initial call
initHome();

// ============================================================
// THREE.JS — Now handled by cinematic.js (global background)
// ============================================================

// ============================================================
// HERO — GSAP Entrance Animation
// ============================================================
(function() {
  const elements = [
    document.getElementById('hero-brand'),
    document.getElementById('hero-drama1'),
    document.getElementById('hero-drama2'),
    document.getElementById('hero-desc'),
    document.getElementById('hero-ctas')
  ];
  const canvas = document.getElementById('hero-canvas') || document.getElementById('cinematic-bg');

  gsap.set(elements, { opacity: 0, y: 60 });
  gsap.to(elements, {
    opacity: 1, y: 0,
    duration: 1, ease: "power3.out",
    stagger: 0.12, delay: 0.4
  });

  if (canvas) gsap.to(canvas, { opacity: 1, duration: 2, delay: 0.3, ease: "power1.inOut" });

  // Scroll indicator fade on scroll
  const scrollInd = document.getElementById('scroll-indicator');
  let scrolledOnce = false;
  window.addEventListener('scroll', () => {
    if (!scrolledOnce && window.scrollY > 50) {
      scrolledOnce = true;
      scrollInd.classList.add('hidden');
    }
  }, { passive: true });
})();

// ============================================================
// FEATURES — Card 1: Diagnostic Shuffler
// ============================================================
(function() {
  const states = [
    { text: 'Chapter 2, Verse 47', label: "Karma Yoga", status: '◆ Audio Ready' },
    { text: 'Chapter 11, Verse 1', label: "Vishwarupa", status: '◆ Visual Active' },
    { text: 'Chapter 6, Verse 35', label: "Dhyana Yoga", status: '◆ Interactive' }
  ];
  const shuffler = document.getElementById('shuffler');
  let current = 0;

  function renderRow(state) {
    const row = document.createElement('div');
    row.className = 'shuffler-row';
    row.innerHTML = `
      <span class="shuffler-text">${state.text}</span>
      <span class="shuffler-text">${state.label}</span>
      <span class="shuffler-pill">${state.status}</span>
    `;
    return row;
  }

  function cycle() {
    const oldRow = shuffler.querySelector('.shuffler-row');
    if (oldRow) {
      oldRow.classList.add('exiting');
      setTimeout(() => oldRow.remove(), 400);
    }

    current = (current + 1) % states.length;
    const newRow = renderRow(states[current]);
    newRow.classList.add('entering');
    shuffler.appendChild(newRow);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newRow.classList.remove('entering');
      });
    });
  }

  setInterval(cycle, 3000);
})();

// ============================================================
// FEATURES — Card 2: Typewriter
// ============================================================
(function() {
  const messages = [
    'कर्म  (karma) → action, duty, work',
    'योग   (yoga)  → union, discipline',
    'धर्म  (dharma) → cosmic order, right path',
    'अर्जुन (arjuna) → the seeker within you',
    'ज्ञान  (jnana)  → knowledge, not belief'
  ];
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const el = document.getElementById('typewriter-text');
  let msgIndex = 0;

  async function typeMessage(msg) {
    el.innerHTML = '<span class="typewriter-cursor">|</span>';
    // Type character by character
    for (let i = 0; i < msg.length; i++) {
      await wait(14);
      el.innerHTML = msg.substring(0, i + 1) + '<span class="typewriter-cursor">|</span>';
    }
    // Hold
    await wait(1500);
    // Scramble
    for (let cycle = 0; cycle < 8; cycle++) {
      let scrambled = '';
      for (let j = 0; j < msg.length; j++) {
        if (msg[j] === ' ') scrambled += ' ';
        else scrambled += charset[Math.floor(Math.random() * charset.length)];
      }
      el.innerHTML = scrambled + '<span class="typewriter-cursor">|</span>';
      await wait(50);
    }
    el.innerHTML = '<span class="typewriter-cursor">|</span>';
    await wait(200);
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function run() {
    while (true) {
      await typeMessage(messages[msgIndex]);
      msgIndex = (msgIndex + 1) % messages.length;
    }
  }
  run();
})();

// ============================================================
// FEATURES — Card 3: SVG Graph animation
// ============================================================
(function() {
  const line = document.getElementById('graph-line');
  const len = line.getTotalLength();
  line.style.strokeDasharray = len;
  line.style.strokeDashoffset = len;

  ScrollTrigger.create({
    trigger: '#feature-card-3',
    start: 'top 85%',
    onEnter: () => {
      gsap.to(line, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: 'power2.out'
      });
    },
    once: true
  });

  // Tooltip
  const tooltip = document.getElementById('graph-tooltip');
  const container = document.getElementById('graph-container');
  const points = document.querySelectorAll('.graph-point');

  points.forEach(p => {
    p.addEventListener('mouseenter', (e) => {
      const session = p.getAttribute('data-session');
      const value = p.getAttribute('data-value');
      tooltip.textContent = `Session ${session}: ${value}%`;
      tooltip.style.opacity = '1';
    });
    p.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 30) + 'px';
    });
    p.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });

  // Point pulse animation
  points.forEach((p, i) => {
    gsap.to(p, {
      attr: { r: 5.6 },
      duration: 1,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      delay: i * 0.15
    });
  });
})();

// ============================================================
// HOW IT WORKS — Entrance + Line animation
// ============================================================
(function() {
  const cards = document.querySelectorAll('.step-card');
  cards.forEach((card, i) => {
    gsap.from(card, {
      opacity: 0, y: 40,
      duration: 1, ease: 'power2.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 85%'
      },
      delay: i * 0.2
    });
  });

  // Dashed line draw
  const dashLine = document.getElementById('steps-dash');
  if (dashLine) {
    const len = 900;
    dashLine.style.strokeDasharray = '6 4';
    dashLine.style.strokeDashoffset = len;
    ScrollTrigger.create({
      trigger: '#how-it-works',
      start: 'top 70%',
      onEnter: () => {
        gsap.to(dashLine, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out' });
      },
      once: true
    });
  }
})();

// ============================================================
// PHILOSOPHY — Parallax + Word-by-word reveal
// ============================================================
(function() {
  const bg = document.getElementById('philosophy-bg');
  gsap.to(bg, {
    y: '20%',
    ease: 'none',
    scrollTrigger: {
      trigger: '#philosophy',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true
    }
  });

  // Word-by-word reveal
  const words = document.querySelectorAll('#phil-manifesto .word');
  gsap.set(words, { opacity: 0, y: 20 });
  ScrollTrigger.create({
    trigger: '#phil-manifesto',
    start: 'top 80%',
    toggleActions: 'play none none none',
    onEnter: () => {
      gsap.to(words, {
        opacity: 1, y: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.035
      });
    },
    once: true
  });

  // Section elements fade
  gsap.utils.toArray('#philosophy .phil-muted, #philosophy .phil-statements p, #philosophy .phil-pivot, #philosophy .phil-sub').forEach((el, i) => {
    gsap.from(el, {
      opacity: 0, y: 30,
      duration: 0.8, ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%'
      },
      delay: i * 0.08
    });
  });
})();

// ============================================================
// STATS — Counter animation
// ============================================================
(function() {
  const statNumbers = document.querySelectorAll('.stat-number');

  ScrollTrigger.create({
    trigger: '#stats-panel',
    start: 'top 80%',
    onEnter: () => {
      statNumbers.forEach(el => {
        const target = parseInt(el.getAttribute('data-target'));
        const suffix = el.getAttribute('data-suffix') || '';
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          snap: { val: 1 },
          onUpdate: () => {
            el.textContent = Math.round(obj.val) + suffix;
          }
        });
      });
    },
    once: true
  });

  gsap.from('#stats-panel', {
    opacity: 0, y: 40,
    duration: 1, ease: 'power2.out',
    scrollTrigger: { trigger: '#stats-panel', start: 'top 85%' }
  });
})();

// ============================================================
// TESTIMONIALS — Carousel
// ============================================================
(function() {
  const slides = document.querySelectorAll('.testimonial-slide');
  const dots = document.querySelectorAll('.testimonial-dot');
  let current = 0;

  function goTo(index) {
    if (index === current) return;
    const dir = index > current ? 1 : -1;
    const currentSlide = slides[current];
    const nextSlide = slides[index];

    gsap.to(currentSlide, {
      x: -60 * dir, opacity: 0, duration: 0.45, ease: 'power2.in',
      onComplete: () => { currentSlide.classList.remove('active'); }
    });

    nextSlide.classList.add('active');
    gsap.fromTo(nextSlide,
      { x: 60 * dir, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
    );

    dots.forEach(d => d.classList.remove('active'));
    dots[index].classList.add('active');
    current = index;
  }

  document.getElementById('test-prev').addEventListener('click', () => {
    goTo(current === 0 ? slides.length - 1 : current - 1);
  });
  document.getElementById('test-next').addEventListener('click', () => {
    goTo(current === slides.length - 1 ? 0 : current + 1);
  });
  dots.forEach(dot => {
    dot.addEventListener('click', () => goTo(parseInt(dot.getAttribute('data-index'))));
  });
})();

// ============================================================
// FAQ — Accordion
// ============================================================
(function() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    const inner = item.querySelector('.faq-answer-inner');

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all
      items.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        i.querySelector('.faq-answer').style.maxHeight = '0';
      });

      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = inner.scrollHeight + 'px';
      }
    });
  });
})();

// ============================================================
// FINAL CTA — Entrance
// ============================================================
gsap.from('#final-cta', {
  scale: 0.95, opacity: 0,
  duration: 1, ease: 'power2.out',
  scrollTrigger: {
    trigger: '#final-cta',
    start: 'top 85%'
  }
});

// ============================================================
// UNIVERSAL SECTION HEADING ANIMATIONS
// ============================================================
gsap.utils.toArray('.section-heading').forEach(el => {
  gsap.from(el, {
    opacity: 0, y: 40,
    duration: 1, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 85%' }
  });
});

// Feature cards entrance
gsap.utils.toArray('.feature-card').forEach((card, i) => {
  gsap.from(card, {
    opacity: 0, y: 40,
    duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: card, start: 'top 85%' },
    delay: i * 0.12
  });
});

// ============================================================
// SAARATHI CHATBOT
// ============================================================
(function() {
  const SAARATHI_SYSTEM_PROMPT = `You are Saarathi — a calm, thoughtful guide to the Bhagavad Gita, built into the GitaVerse learning platform.

Your role:
- Answer questions about the Bhagavad Gita: its shlokas, philosophy, characters (Krishna, Arjuna, Duryodhana, etc.), themes (karma, dharma, yoga, moksha, atman, brahman), and historical/mythological context.
- Help modern people (especially students and young professionals) connect Gita teachings to real-life challenges: anxiety, purpose, relationships, work, and identity.
- When appropriate, quote relevant shlokas — always in this format:
  Sanskrit: [shloka in Devanagari]
  Chapter X, Verse Y
  Meaning: [plain English, one sentence]
- Guide confused or curious visitors toward starting their GitaVerse journey.

Your tone:
- Calm, clear, unhurried. Like a patient teacher, not a chatbot.
- Never preachy. Never push belief. The Gita is philosophy first.
- Short responses by default (3–5 sentences). Go deeper only if asked.
- Use "you" directly. Never say "our users" or "learners."
- No bullet points unless listing shlokas. No markdown headers. Write in natural, flowing prose.
- Banned phrases: "Great question!", "Certainly!", "Absolutely!", "I'd be happy to help", "As an AI".

What you don't do:
- You don't answer questions unrelated to the Gita, philosophy, spirituality, or GitaVerse. Politely redirect: "I'm here to help you explore the Gita. What would you like to understand?"
- You don't make definitive religious claims or push any sect or interpretation.
- You don't provide pricing or support details — say "For that, our team can help via the contact page."

Always end your first message in a new conversation with a gentle invitation: "What would you like to explore first?"`;

  const fab = document.getElementById('saarathi-fab');
  const chatWindow = document.getElementById('chat-window');
  const chatClose = document.getElementById('chat-close');
  const chatClear = document.getElementById('chat-clear');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatMessages = document.getElementById('chat-messages');
  const chatSuggestions = document.getElementById('chat-suggestions');
  const suggestionPills = document.querySelectorAll('.suggestion-pill');

  let chatOpen = false;
  let conversationHistory = [];
  let isLoading = false;
  const firstOpen = !localStorage.getItem('saarathi_opened');

  // Show FAB after scrolling past hero
  const heroEl = document.getElementById('hero');
  const fabObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) {
      fab.classList.add('visible');
    } else {
      if (!chatOpen) fab.classList.remove('visible');
    }
  }, { threshold: 0.1 });
  fabObserver.observe(heroEl);

  // Toggle chat
  function toggleChat() {
    chatOpen = !chatOpen;
    if (chatOpen) {
      chatWindow.classList.add('open');
      fab.classList.add('chat-open');
      fab.textContent = '✕ Close';
      fab.setAttribute('aria-label', 'Close chatbot');
      fab.classList.add('visible');

      gsap.fromTo(chatWindow,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' }
      );

      // First open welcome
      if (firstOpen && conversationHistory.length === 0) {
        renderBotBubble("Namaste. I'm Saarathi — your guide through the Bhagavad Gita.\n\nWhether you're new to the Gita or returning after years, I'm here to help you understand it on your own terms. No Sanskrit required. No beliefs assumed.\n\nWhat would you like to explore first?");
        localStorage.setItem('saarathi_opened', 'true');
      }

      setTimeout(() => chatInput.focus(), 100);
    } else {
      gsap.to(chatWindow, {
        opacity: 0, y: 12, scale: 0.97, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          chatWindow.classList.remove('open');
        }
      });
      fab.classList.remove('chat-open');
      fab.textContent = '✦ Ask Saarathi';
      fab.setAttribute('aria-label', 'Open Saarathi chatbot');
    }
  }

  fab.addEventListener('click', toggleChat);
  chatClose.addEventListener('click', toggleChat);

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatOpen) toggleChat();
  });

  // Clear conversation
  chatClear.addEventListener('click', () => {
    conversationHistory = [];
    chatMessages.innerHTML = '';
    chatSuggestions.classList.remove('collapsed');
  });

  // Render user bubble
  function renderUserBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-user';
    bubble.setAttribute('role', 'article');
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    gsap.from(bubble, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
    scrollToBottom();
  }

  // Render bot bubble — handles plain text and structured **Label**\nText format
  function renderBotBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-bot';
    bubble.setAttribute('role', 'article');

    const header = document.createElement('div');
    header.className = 'msg-bot-header';
    header.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="1.5">
        <path d="M12 2C12 2 8 6 8 10c0 2.21 1.79 4 4 4s4-1.79 4-4c0-4-4-8-4-8z"/>
        <path d="M12 14c-2.5 0-5 1.5-5 5h10c0-3.5-2.5-5-5-5z"/>
      </svg>
      <span>Saarathi</span>
    `;
    bubble.appendChild(header);

    const content = document.createElement('div');
    // Render structured sections (**Label** → styled heading)
    let rendered = text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--champagne);display:block;margin-top:0.6rem;margin-bottom:0.2rem;font-size:0.75rem;letter-spacing:0.06em;text-transform:uppercase;">$1</strong>')
      .replace(/\n/g, '<br>');
    // Render shloka blocks
    const shlokaPattern = /Sanskrit:\s*([\s\S]+?)\n(Chapter \d+, Verse \d+)\nMeaning:\s*(.+)/g;
    rendered = rendered.replace(/Sanskrit:\s*([\s\S]*?)<br>(Chapter \d+, Verse \d+)<br>Meaning:\s*(.+?)(?=<br>|$)/g,
      (match, sanskrit, ref, meaning) => `
        <div class="shloka-block">
          ${sanskrit.trim()}
          <div class="shloka-ref">${ref}</div>
        </div>
        <span class="shloka-meaning">${meaning.trim()}</span>
      `
    );
    content.innerHTML = rendered;
    bubble.appendChild(content);

    chatMessages.appendChild(bubble);
    gsap.from(bubble, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
    scrollToBottom();
  }

  // Render error bubble
  function renderErrorBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-error';
    bubble.setAttribute('role', 'article');
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    gsap.from(bubble, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
    scrollToBottom();
  }

  // Typing indicator
  function showTyping() {
    const ind = document.createElement('div');
    ind.className = 'typing-indicator';
    ind.id = 'typing-indicator';
    ind.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    chatMessages.appendChild(ind);
    scrollToBottom();
  }
  function hideTyping() {
    const ind = document.getElementById('typing-indicator');
    if (ind) ind.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
  }

  function setLoading(val) {
    isLoading = val;
    chatSend.classList.toggle('disabled', val);
  }

  // Send message
  async function handleSend(inputText) {
    if (!inputText.trim() || isLoading) return;

    // Collapse suggestions
    chatSuggestions.classList.add('collapsed');

    renderUserBubble(inputText);
    const userMsg = { role: 'user', content: inputText };
    conversationHistory.push(userMsg);

    showTyping();
    setLoading(true);
    chatInput.value = '';

    try {
      const reply = await sendToSaarathi(conversationHistory);
      hideTyping();
      conversationHistory.push({ role: 'assistant', content: reply });
      renderBotBubble(reply);
    } catch (err) {
      hideTyping();
      renderErrorBubble('Something interrupted the connection. Try again.');
      console.error('Saarathi error:', err);
    } finally {
      setLoading(false);
    }
  }

  // API call — proxied through backend (keeps API key server-side)
  async function sendToSaarathi(history) {
    const last = history[history.length - 1]?.content || '';
    const response = await fetch('/api/saarathi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: last, history: history.slice(0, -1) }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    // Format structured response for renderBotBubble
    return formatSaarathiResponse(data);
  }

  function formatSaarathiResponse(data) {
    if (typeof data === 'string') return data;
    let out = '';
    if (data.explanation)  out += `**Understanding**\n${data.explanation}`;
    if (data.application)  out += `\n\n**In Your Life**\n${data.application}`;
    if (data.relatedVerse && data.relatedVerse.chapter) {
      out += `\n\n**Explore Also**\nChapter ${data.relatedVerse.chapter}, Verse ${data.relatedVerse.verse} — ${data.relatedVerse.reason || ''}`;
    }
    return out || 'I could not form a response. Please try again.';
  }

  // Simulated responses retained for demo (shown when API key is blank)
  // — kept as internal fallback, not called when backend is active
  function simulateResponse(question) {
    const q = question.toLowerCase();
    const responses = {
      'main message': "The Gita's central teaching is about doing your duty without being attached to the result. Krishna tells Arjuna that action is unavoidable — but suffering comes from clinging to outcomes. Your role is to act with clarity and skill, then let go.",
      'anxiety': "Krishna addresses anxiety directly in Chapter 2. He tells Arjuna that fear comes from identifying too strongly with outcomes you cannot control. The remedy is not detachment from life, but detachment from the need for things to go a specific way.\n\nSanskrit: कर्मण्येवाधिकारस्ते मा फलेषु कदाचन\nChapter 2, Verse 47\nMeaning: You have the right to act, but never to the fruit of action.",
      'karma': "Karma literally means \"action\" — not punishment, not fate. In the Gita, Krishna explains that every action creates a consequence, but the quality of an action depends on your intention and awareness, not just the outcome.",
      'arjuna': "Arjuna is a warrior standing on a battlefield, about to fight a war against his own family. He freezes — not from cowardice, but from conscience. The entire Gita is Krishna's answer to that moment of moral paralysis.",
      'dharma': "Dharma is the order of things — your role, your responsibility, what the situation asks of you. Karma is the action you take. When you act according to your dharma without selfish motive, the karma does not bind you.",
    };
    return new Promise((resolve) => {
      setTimeout(() => {
        for (const [key, val] of Object.entries(responses)) {
          if (q.includes(key)) return resolve(val);
        }
        resolve('The Gita speaks to this in a subtle way. At its core, the text is about understanding who you are beneath your roles, fears, and desires — and acting from that understanding.');
      }, 800 + Math.random() * 1200);
    });
  }

  // Input handlers
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(chatInput.value);
    }
  });

  chatSend.addEventListener('click', () => {
    handleSend(chatInput.value);
  });

  // Suggestion pills
  suggestionPills.forEach(pill => {
    pill.addEventListener('click', () => {
      handleSend(pill.textContent);
    });
  });

  // Focus trap when chat is open
  chatWindow.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = chatWindow.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
})(); // end Saarathi chatbot IIFE

(function() {
  // ══════════════════════════════════════════════════════════════
  // CUSTOM CURSOR — Zero-lag, GPU-composited, native-feel tracking
  // ══════════════════════════════════════════════════════════════

  // Belt-and-suspenders: enforce cursor: none via JS immediately
  // (covers browsers that don't honour CSS cursor:none on <html>)
  document.documentElement.style.setProperty('cursor', 'none', 'important');
  document.body.style.setProperty('cursor', 'none', 'important');

  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  // Disable entirely on touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('no-cursor');
    cursor.style.display = 'none';
    return;
  }

  // Raw mouse coords — updated only in mousemove (no DOM work here)
  let mx = -100, my = -100;
  let rafId = null;
  let visible = false;

  // Show cursor the moment the mouse enters the viewport
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;

    // Reveal cursor on first move (starts at opacity:0 in CSS)
    if (!visible) {
      visible = true;
      cursor.style.opacity = '1';
    }
  }, { passive: true });

  // Hide when mouse leaves the document, restore on re-enter
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { if (visible) cursor.style.opacity = '1'; });

  // Click feedback — cursor shrinks on mousedown, returns on mouseup
  document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
  document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));

  // ── rAF render loop ──────────────────────────────────────────
  // DIRECT tracking (no lerp) so there is zero perceptible lag.
  // The premium "feel" comes from CSS transitions on width/height
  // for hover/click states — those animate smoothly without
  // affecting how fast the cursor follows the pointer.
  let prevX, prevY;
  function tick() {
    // Only write to DOM if position actually changed (saves GPU work)
    if (mx !== prevX || my !== prevY) {
      prevX = mx;
      prevY = my;
      // translate3d keeps the element on its own GPU compositing layer
      cursor.style.transform = `translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ── Hover targets ─────────────────────────────────────────────
  // All interactive element types that should trigger cursor expand
  const HOVER_SEL = 'a, button, select, input, textarea, label, [role="button"], [tabindex], .cursor-pointer';

  function bindHover(el) {
    if (el._cursorBound) return;
    el._cursorBound = true;
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'),    { passive: true });
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'), { passive: true });
  }

  document.querySelectorAll(HOVER_SEL).forEach(bindHover);

  // Handle elements added after initial load (verse cards, etc.)
  new MutationObserver(() => {
    document.querySelectorAll(HOVER_SEL).forEach(bindHover);
  }).observe(document.body, { childList: true, subtree: true });

})();

// ── Language Toggle ───────────────────────────────────────────────
(function() {
  const translations = {
    brand_name:        { en: 'GitaVerse',               hi: 'गीताVERSE' },
    nav_learn:         { en: 'Learn',                   hi: 'सीखें' },
    nav_how_it_works:  { en: 'How It Works',            hi: 'कैसे काम करता है' },
    nav_wisdom:        { en: 'Wisdom',                  hi: 'ज्ञान' },
    nav_about:         { en: 'About',                   hi: 'के बारे में' },
    nav_start_journey: { en: 'Start Your Gita Journey', hi: 'अपनी गीता यात्रा शुरू करें' },
    hero_brand:        { en: 'GitaVerse',               hi: 'गीताVERSE' },
    hero_drama1:       { en: 'Ancient wisdom.',         hi: 'प्राचीन ज्ञान।' },
    hero_drama2:       { en: 'Modern clarity.',         hi: 'आधुनिक स्पष्टता।' },
    hero_drama2_accent:{ en: 'Modern clarity.',         hi: 'आधुनिक स्पष्टता।' },
    hero_desc:         { en: 'Every shloka — cinematic visuals, audio chanting, and word-by-word meaning. Built for the way you actually think.', hi: 'हर श्लोक — सिनेमाई दृश्य, ऑडियो चैंटिंग, और शब्द-शब्द अर्थ। आपके सोचने के तरीके के लिए बनाया गया।' },
    cta_start:         { en: 'Start Your Gita Journey →', hi: 'अपनी गीता यात्रा शुरू करें →' },
    cta_explore:       { en: 'Explore Shlokas',         hi: 'श्लोक देखें' }
  };

  const langToggleBtn = document.getElementById('lang-toggle');
  let currentLang = localStorage.getItem('gitaverse_lang') || 'en';

  const applyLanguage = (lang) => {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
      const key = el.getAttribute('data-i18n-key');
      if (translations[key] && translations[key][lang]) {
        el.textContent = translations[key][lang];
      }
    });
    if (langToggleBtn) {
      langToggleBtn.textContent = lang === 'en' ? 'हिन्दी' : 'English';
    }
    localStorage.setItem('gitaverse_lang', lang);
    currentLang = lang;
  };

  applyLanguage(currentLang);

  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      const newLang = currentLang === 'en' ? 'hi' : 'en';
      applyLanguage(newLang);
    });
  }
})();

// ============================================================
// SITUATION MAP
// ============================================================
(function() {
  const grid   = document.getElementById('situation-grid');
  const result = document.getElementById('situation-result');
  if (!grid || !result) return;

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('.situation-btn');
    if (!btn) return;
    grid.querySelectorAll('.situation-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.situation;
    result.innerHTML = `<div style="display:flex;gap:1rem;flex-direction:column;"><div style="height:80px;background:rgba(255,255,255,0.04);border-radius:12px;animation:spin 1.4s ease-in-out infinite;"></div><div style="height:80px;background:rgba(255,255,255,0.04);border-radius:12px;"></div></div>`;

    try {
      const res = await fetch('/api/situation/' + type);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.verses || !data.verses.length) { result.innerHTML = '<p style="color:var(--stone);text-align:center;">No verses found.</p>'; return; }
      result.innerHTML = data.verses.map(v => {
        const text = v.siva?.et || v.tej?.ht || '';
        return `<div style="background:rgba(18,18,31,0.92);border:1px solid rgba(201,168,76,0.15);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:0.75rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--champagne);background:rgba(201,168,76,0.08);padding:0.25rem 0.65rem;border-radius:5px;">Ch. ${v.chapter} · Verse ${v.verse}</span>
            <a href="/verses#chapter/${v.chapter}/verse/${v.verse}" style="font-family:var(--font-mono);font-size:0.7rem;color:var(--stone);text-decoration:none;">Read full verse →</a>
          </div>
          ${v.slok ? `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:1rem;color:var(--ivory);line-height:1.8;margin-bottom:0.75rem;padding-left:1rem;border-left:2px solid rgba(201,168,76,0.4);">${v.slok}</div>` : ''}
          ${text ? `<div style="font-size:0.88rem;color:var(--stone);line-height:1.7;font-style:italic;">"${text}"</div>` : ''}
        </div>`;
      }).join('');
    } catch (err) {
      result.innerHTML = '<p style="color:#E87070;text-align:center;font-size:0.85rem;">Could not load verses. Please try again.</p>';
    }
  });
})();

// ============================================================
// VERSE OF THE DAY
// ============================================================
(function() {
  const CHAPTER_STARTS = (() => {
    const counts = [47,72,43,42,29,47,30,28,34,42,55,20,34,27,20,24,28,78];
    const s = [0];
    for (let i = 0; i < counts.length - 1; i++) s.push(s[i] + counts[i]);
    return { counts, starts: s };
  })();

  const container = document.getElementById('verse-of-day');
  if (!container) return;

  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const idx   = Math.floor((now - start) / 86400000) % 700;
  let ch = 0;
  while (ch < CHAPTER_STARTS.starts.length - 1 && CHAPTER_STARTS.starts[ch + 1] <= idx) ch++;
  const chapter = ch + 1;
  const verse   = idx - CHAPTER_STARTS.starts[ch] + 1;

  fetch('/api/verse/' + chapter + '/' + verse)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const text = data.siva?.et || data.tej?.ht || '';
      container.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(201,168,76,0.06),rgba(18,18,31,0.92));border:1px solid rgba(201,168,76,0.2);border-radius:16px;padding:2rem;max-width:640px;margin:0 auto;">
          <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--champagne);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:1rem;">✦ Verse of the Day</div>
          <div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:1.1rem;color:var(--ivory);line-height:1.9;margin-bottom:1rem;">${data.slok || ''}</div>
          ${text ? '<div style="font-size:0.88rem;color:var(--stone);line-height:1.7;margin-bottom:1.25rem;font-style:italic;">&ldquo;' + text + '&rdquo;</div>' : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
            <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--stone);">Chapter ${chapter} · Verse ${verse}</span>
            <a href="/verses#chapter/${chapter}/verse/${verse}" style="background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:var(--champagne);text-decoration:none;padding:0.4rem 1rem;border-radius:8px;font-size:0.8rem;">Listen &amp; Read →</a>
          </div>
        </div>`;
    })
    .catch(() => { container.style.display = 'none'; });
})();

// ============================================================
// HOMEPAGE ENGAGEMENT — Streak + Recently Viewed
// ============================================================
(function() {
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('gv_lastVisit');
  let streak = parseInt(localStorage.getItem('gv_streak') || '0', 10);
  if (!lastVisit) { streak = 1; }
  else {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (lastVisit === yesterday.toDateString()) streak++;
    else if (lastVisit !== today) streak = 1;
  }
  localStorage.setItem('gv_lastVisit', today);
  localStorage.setItem('gv_streak', streak);

  if (streak >= 2) {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      const badge = document.createElement('li');
      badge.innerHTML = '<span style="color:var(--champagne);font-family:var(--font-mono);font-size:0.75rem;white-space:nowrap;">\uD83D\uDD25 ' + streak + ' days</span>';
      navLinks.prepend(badge);
    }
  }

  const recent = (() => { try { return JSON.parse(localStorage.getItem('gv_recentlyViewed') || '[]'); } catch(_) { return []; } })();
  const recentSection   = document.getElementById('recently-viewed-section');
  const recentContainer = document.getElementById('recently-viewed-list');
  if (recentContainer && recent.length > 0) {
    if (recentSection) recentSection.style.display = 'block';
    recentContainer.innerHTML = recent.map(ch => `
      <a href="/verses#chapter/${ch}" style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(18,18,31,0.8);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:0.5rem 1rem;text-decoration:none;color:var(--ivory);font-size:0.82rem;">
        <span style="font-family:var(--font-mono);color:var(--champagne);font-size:0.7rem;">${String(ch).padStart(2,'0')}</span> Chapter ${ch}
      </a>`).join('');
  }
})();
