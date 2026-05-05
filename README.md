<div align="center">
  <img src="https://raw.githubusercontent.com/Aryanrajpandey/GitaVerse/main/public/krishna-bg.png" alt="GitaVerse Header" width="100%" style="border-radius: 12px; max-height: 350px; object-fit: cover;">
  
  <br />

  <h1>🕉️ GitaVerse</h1>
  <p><strong>Ancient Wisdom. Modern Clarity.</strong></p>

  <p>
    A full-stack Bhagavad Gita learning platform engineered for absolute performance, featuring cinematic visuals, deep interactive verse exploration, and an AI spiritual companion.
  </p>

  <div>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JS" />
    <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  </div>
</div>

---

## ✨ Features

- 🌌 **Cinematic Experience**: Immersive Three.js dynamic backgrounds and GSAP scroll animations.
- 📖 **Complete 700 Verses Library**: Fast, virtualized browsing of all 18 chapters with Sanskrit, transliteration, and 15+ commentaries.
- 🤖 **Saarathi AI Companion**: Context-aware AI chatbot built to guide you through the philosophy of the Gita (Powered by Anthropic Claude).
- 🎧 **Native-Quality Audio**: Listen to Sanskrit chants natively via Web Speech API or High-Quality TTS (ElevenLabs/Google).
- ⚡ **Production-Grade Performance**: Custom LRU caching, response chunking, gzip compression, and instantaneous SPA navigation.

## 🏗️ Architecture Flow

The system is designed to provide instantaneous data access by combining an optimized Node backend with heavy caching mechanisms.

```mermaid
graph TD
    classDef client fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#fff
    classDef server fill:#2b6cb0,stroke:#2c5282,stroke-width:2px,color:#fff
    classDef cache fill:#c53030,stroke:#9b2c2c,stroke-width:2px,color:#fff
    classDef external fill:#4a5568,stroke:#2d3748,stroke-width:2px,color:#fff

    User((👤 Client)):::client

    subgraph GitaVerse Backend
        Express[🟢 Node.js + Express]:::server
        DiskCache[(💾 Disk LRU Cache)]:::cache
        MemCache[(🧠 Memory Cache)]:::cache
    end

    subgraph External APIs
        Vedic[📜 Vedic Scriptures API]:::external
        ElevenLabs[🗣️ ElevenLabs TTS]:::external
        Claude[🧠 Anthropic Claude]:::external
        GoogleTTS[🌐 Google TTS]:::external
    end

    User -->|API / Navigation Requests| Express
    Express -->|Check| MemCache
    Express -->|Check| DiskCache
    Express -->|Fetch Verses (Batched)| Vedic
    Express -->|Chat Context| Claude
    Express -->|Generate Audio| ElevenLabs
    ElevenLabs -.->|Fallback| GoogleTTS
    
    DiskCache --> Express
    MemCache --> Express
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/Aryanrajpandey/GitaVerse.git
cd GitaVerse

# 2. Install dependencies
npm install

# 3. Configure environment (Optional: For AI & HQ TTS)
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY

# 4. Start the server
npm run dev
```

Open `http://localhost:3000` in your browser.

## 🗺️ Project Structure

| Directory/File | Purpose |
|----------------|---------|
| 📂 `public/` | All frontend static assets (HTML, CSS, JS) |
| 📄 `public/index.html` | The cinematic landing page |
| 📄 `public/verses.html` | The main verse exploration SPA |
| 📄 `server.js` | Express.js backend server |
| 📂 `data/` | Automatically generated persistent cache for verses |
| 📂 `audio-cache/` | Automatically generated disk cache for TTS audio |

## 🔌 API Reference

The backend acts as an optimized proxy to the Vedic Scriptures API.

- `GET /api/chapters` - Returns all 18 chapters and summaries.
- `GET /api/chapter/:ch` - Returns metadata for a specific chapter.
- `GET /api/verses/:ch?offset=0&limit=100` - Returns a paginated list of verses. (Batched upstream fetching to prevent rate limits).
- `GET /api/verse/:ch/:verse` - Get deep data on a specific shloka.
- `POST /api/saarathi` - Interact with the AI companion.
- `POST /api/generate-audio` - Request TTS generation for a verse.

## 📜 License

This project is licensed under the MIT License.

---
<div align="center">
  <i>Made with ☕ and devotion in India 🇮🇳</i>
</div>
