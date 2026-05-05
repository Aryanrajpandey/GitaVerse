# GitaVerse — Ancient Wisdom. Modern Clarity.

A full-stack Bhagavad Gita learning platform with cinematic visuals, interactive verse exploration, and an AI companion (Saarathi).

## Features

- **Cinematic Landing Page** — Three.js hero, GSAP scroll animations, premium dark theme
- **700 Verses Library** — Browse all 18 chapters with Sanskrit, transliteration, and translations from 15+ scholars
- **Saarathi AI Chatbot** — Gita-focused conversational guide
- **Responsive Design** — Works on desktop, tablet, and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Animations** | Three.js, GSAP + ScrollTrigger |
| **Data** | [Vedic Scriptures API](https://vedicscriptures.github.io/) (free, no API key) |

## Getting Started

### Prerequisites
- Node.js 18+ installed

### Setup

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

The app runs at **http://localhost:3000**

### Pages

| Route | Description |
|-------|-------------|
| `/` | Cinematic landing page |
| `/verses` | Full Gita verses library (18 chapters, 700 verses) |

## API Routes

The Express server proxies the Vedic Scriptures API with in-memory caching:

| Endpoint | Description |
|----------|-------------|
| `GET /api/chapters` | All 18 chapters with names and summaries |
| `GET /api/chapter/:ch` | Specific chapter details |
| `GET /api/verses/:ch` | All verses for a chapter |
| `GET /api/verse/:ch/:verse` | Specific verse with all commentaries |

## Project Structure

```
GITAVERSE/
├── server.js          — Express server (API proxy + static files)
├── package.json       — npm configuration
├── public/
│   ├── index.html     — Landing page
│   ├── style.css      — Landing page styles
│   ├── script.js      — Landing page JavaScript
│   ├── verses.html    — Verses library page
│   ├── verses.css     — Verses page styles
│   └── verses.js      — Verses page JavaScript
└── README.md          — This file
```

## Saarathi Chatbot

The Saarathi chatbot on the landing page operates in **demo mode** by default (simulated responses). To enable live AI responses:

1. Set up a backend proxy for the Anthropic API
2. Add your API key to the proxy

> **Note:** Never expose API keys in client-side code.

## Data Source

All Gita verse data comes from the [Vedic Scriptures API](https://vedicscriptures.github.io/), an open-source project. Data is cached on the server for 1 hour to minimize upstream requests.

## License

MIT

---

Made with care in India 🇮🇳
