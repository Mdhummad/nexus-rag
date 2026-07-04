<div align="center">

# ⚡ Nexus RAG

### Production-grade Retrieval-Augmented Generation for Research Papers

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5.20-FF6B35?style=flat-square)](https://www.trychroma.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.1-F55036?style=flat-square)](https://console.groq.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

Upload research PDFs → Ask questions → Get cited, confidence-scored answers in real time

[Live Demo](#) · [Report Bug](https://github.com/Mdhummad/nexus-rag/issues) · [Request Feature](https://github.com/Mdhummad/nexus-rag/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [RAG Pipeline](#-rag-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [API Reference](#-api-reference)
- [Frontend](#-frontend)
- [Deployment](#-deployment)
  - [Render (Backend + ChromaDB)](#render-backend--chromadb)
  - [Vercel (Frontend)](#vercel-frontend)
- [Security](#-security)
- [Performance](#-performance)
- [File-by-File Breakdown](#-file-by-file-breakdown)
- [Contributing](#-contributing)

---

## 🧠 Overview

**Nexus RAG** is a full-stack, production-ready Retrieval-Augmented Generation (RAG) system purpose-built for academic research. It allows you to upload multiple research PDFs and ask complex questions across all of them — receiving detailed, inline-cited answers grounded exclusively in the uploaded documents.

The system implements an advanced multi-stage RAG pipeline far beyond simple vector search:

```
Your Question
    │
    ├─► Query Expansion (LLM generates 2 reformulations)
    │
    ├─► Multi-Query Retrieval (all 3 queries searched in ChromaDB)
    │
    ├─► MMR Re-ranking (Maximal Marginal Relevance — diversity filter)
    │
    ├─► LLM Re-ranking (Groq scores each chunk 0.0–1.0 for relevance)
    │
    └─► Answer Generation (Groq writes a cited answer)
            │
            └─► Streamed token-by-token to your browser
```

---

## ✨ Features

### RAG Pipeline
- **Multi-query expansion** — LLM generates 2 semantic reformulations of each question to improve recall
- **MMR diversity** — Maximal Marginal Relevance selects diverse, non-redundant chunks
- **LLM re-ranking** — Groq scores each retrieved chunk for relevance before answering
- **Streaming responses** — Answer appears word-by-word via Server-Sent Events (SSE)
- **Inline citations** — Every answer cites `[Paper: Title, Page: N]` with real page numbers
- **Confidence scoring** — Each answer includes a calibrated 0–100% confidence bar
- **Per-step timings** — Retrieval, expansion, reranking, and generation times shown per query

### Document Processing
- **Real per-page extraction** — Uses `pdf-parse` pagerender callback for accurate page numbers
- **Smart chunking** — `RecursiveCharacterTextSplitter` with 1000-char chunks / 200-char overlap
- **LLM metadata extraction** — Title, authors, year, abstract extracted automatically on upload
- **Local embeddings** — `all-MiniLM-L6-v2` via `@xenova/transformers` runs on-server (no API cost)
- **Deep analysis** — Summary, methodology, contributions, limitations, future work per paper

### Production Infrastructure
- **SQLite persistence** — Paper metadata stored in WAL-mode SQLite (atomic, concurrent-safe)
- **API key auth** — `X-API-Key` header or `Authorization: Bearer` with dev-mode bypass
- **Rate limiting** — 15 queries/min, 10 uploads/min, 20 analysis/min per IP
- **HTTP security headers** — Full `helmet` middleware (CSP, HSTS, X-Frame-Options, etc.)
- **Zod validation** — All API inputs schema-validated with descriptive error messages
- **Graceful shutdown** — SIGTERM/SIGINT handlers for clean Render container restarts
- **ChromaDB retry** — 8 attempts with 5s delay on startup (handles slow container boot)
- **React ErrorBoundary** — Styled crash UI instead of blank white screen
- **XSS protection** — `rehype-sanitize` on all LLM-generated markdown output

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Vercel)                         │
│                                                                 │
│  ┌──────────────┐    ┌───────────────────────────────────────┐  │
│  │   Sidebar    │    │              Chat Area                │  │
│  │              │    │                                       │  │
│  │ • Paper list │    │  User question ──► Token-by-token     │  │
│  │ • Upload PDF │    │  Sources panel     streaming answer   │  │
│  │ • Select     │    │  Confidence bar    (SSE)              │  │
│  │   papers     │    │  Expanded queries                     │  │
│  │ • Deep       │    │  Per-step timings                     │  │
│  │   analysis   │    │                                       │  │
│  └──────────────┘    └───────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS (Fetch / SSE)
┌───────────────────────────────▼─────────────────────────────────┐
│                    Node.js Backend (Render)                      │
│                                                                 │
│  Express.js · helmet · cors · express-rate-limit · zod          │
│                                                                 │
│  Routes:                                                        │
│  GET  /api/health          ← connection status                  │
│  POST /api/papers/upload   ← PDF ingestion pipeline             │
│  GET  /api/papers          ← list all papers                    │
│  DEL  /api/papers/:id      ← delete paper + vectors             │
│  POST /api/papers/:id/analyze ← deep analysis                   │
│  POST /api/query           ← standard RAG query                 │
│  POST /api/query/stream    ← SSE streaming RAG query            │
│                                                                 │
│  Services:                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ ragService   │  │ingestionSvc  │  │  analysisService   │   │
│  │              │  │              │  │                    │   │
│  │ • Expansion  │  │ • pdf-parse  │  │ • summary          │   │
│  │ • Retrieval  │  │ • LLM meta   │  │ • methodology      │   │
│  │ • MMR        │  │ • Chunking   │  │ • contributions    │   │
│  │ • Reranking  │  │ • Embedding  │  │ • limitations      │   │
│  │ • Generation │  │ • ChromaDB   │  │ • future_work      │   │
│  │ • Streaming  │  │   upsert     │  │                    │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │     llmService       │  │        database.js           │    │
│  │                      │  │                              │    │
│  │ • Groq (LLaMA 3.1)   │  │ • SQLite WAL-mode            │    │
│  │ • all-MiniLM-L6-v2   │  │ • better-sqlite3             │    │
│  │   (local, no API $)  │  │ • atomic CRUD                │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
└──────────┬──────────────────────────────────────────────────────┘
           │ HTTP (internal network)
┌──────────▼──────────┐
│  ChromaDB (Render)  │
│                     │
│  Vector Database    │
│  • 384-dim vectors  │
│  • Cosine distance  │
│  • Metadata filter  │
│  • Embeddings API   │
└─────────────────────┘
```

---

## 🔬 RAG Pipeline

### 1. Ingestion (Upload)
```
PDF File
  │
  ├── pdf-parse (pagerender callback)
  │     └── Per-page text extraction with real page numbers
  │
  ├── Groq LLaMA 3.1 (metadata extraction)
  │     └── title, authors, year, abstract ← first 2000 chars
  │
  ├── RecursiveCharacterTextSplitter
  │     ├── chunkSize: 1000 chars
  │     └── chunkOverlap: 200 chars
  │
  ├── Xenova/all-MiniLM-L6-v2 (local embedding)
  │     └── 384-dimensional vectors, batch processed
  │
  └── ChromaDB upsert
        └── vectors + text + metadata (paper_id, page, chunk_index)
```

### 2. Query (Ask)
```
User Question
  │
  ├── [EXPANSION] Groq generates 2 reformulations
  │     └── ["original", "reformulation 1", "reformulation 2"]
  │
  ├── [RETRIEVAL] Each query embedded + searched in ChromaDB
  │     ├── include: embeddings (for real MMR)
  │     ├── top_k * 2 results per query
  │     └── deduplicated by chunk_id
  │
  ├── [MMR] Maximal Marginal Relevance
  │     ├── λ·relevance − (1−λ)·redundancy
  │     └── selects diverse chunks using real embedding cosine sim
  │
  ├── [RERANKING] Groq scores each chunk 0.0–1.0
  │     ├── parallel via Promise.all
  │     └── sorted descending, top RERANK_TOP_K kept
  │
  └── [GENERATION] Groq LLaMA 3.1 with citation-aware prompt
        ├── Standard: full answer returned at once
        └── Streaming: tokens emitted via SSE as generated
              ├── data: {"type":"meta", "sources":[...], "confidence":0.85}
              ├── data: {"type":"token", "content":"The "}
              ├── data: {"type":"token", "content":"study..."}
              └── data: {"type":"done", "processingTimeMs":2341}
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22+ | Runtime |
| Express.js | ^4 | HTTP server |
| LangChain | ^0.3 | LLM orchestration |
| @langchain/groq | ^0.1 | Groq API integration |
| @xenova/transformers | ^2 | Local embedding model |
| ChromaDB Client | ^1.9 | Vector database client |
| better-sqlite3 | ^9 | SQLite (paper metadata) |
| pdf-parse | ^1.1 | PDF text extraction |
| multer | ^1 | File upload handling |
| helmet | ^8 | HTTP security headers |
| express-rate-limit | ^7 | Rate limiting |
| zod | ^3 | Schema validation |
| uuid | ^9 | Unique paper/chunk IDs |
| dotenv | ^16 | Environment config |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | ^18 | UI framework |
| Vite | ^6 | Build tool + dev server |
| react-markdown | ^9 | Markdown rendering |
| rehype-sanitize | ^6 | XSS protection on LLM output |
| lucide-react | ^0.4 | Icons |

### Infrastructure
| Service | Purpose |
|---|---|
| Render | Backend + ChromaDB hosting |
| Vercel | Frontend hosting |
| GitHub | Source control + CI/CD trigger |
| Groq Cloud | LLM inference (free tier) |

---

## 📁 Project Structure

```
nexus-rag/
│
├── render.yaml                 # Render Blueprint — deploys both services
│
├── backend/
│   ├── package.json
│   ├── .env.example            # Template for environment variables
│   ├── .env                    # Local secrets (never committed)
│   │
│   └── src/
│       ├── server.js           # Entry point — Express app + boot sequence
│       │
│       ├── middleware/
│       │   ├── auth.js         # API key authentication
│       │   └── upload.js       # Multer PDF-only file handler
│       │
│       ├── routes/
│       │   ├── health.js       # GET /api/health — status check
│       │   ├── papers.js       # GET/POST/DELETE /api/papers
│       │   └── query.js        # POST /api/query + /api/query/stream
│       │
│       └── services/
│           ├── database.js     # SQLite service (better-sqlite3, WAL mode)
│           ├── chromaService.js # ChromaDB connection + retry logic
│           ├── llmService.js   # Groq LLM + local embedding model factory
│           ├── ingestionService.js # PDF → chunks → embeddings → ChromaDB
│           ├── ragService.js   # Full RAG pipeline (standard + streaming)
│           └── analysisService.js  # Deep paper analysis (5 types)
│
└── frontend/
    ├── package.json
    ├── vite.config.js          # Vite config + /api proxy for dev
    ├── vercel.json             # SPA rewrite rules for Vercel
    ├── index.html              # Single HTML shell
    │
    └── src/
        ├── main.jsx            # React bootstrap + ErrorBoundary
        ├── App.jsx             # Full UI (chat, sidebar, settings, toasts)
        │
        ├── hooks/
        │   └── usePapers.js    # Papers state + upload/remove logic
        │
        └── utils/
            └── api.js          # Fetch wrapper + SSE streaming client
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 22+ ([download](https://nodejs.org))
- **Python** 3.9–3.12 with `chromadb` installed, OR **Docker**
- **Groq API key** (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Mdhummad/nexus-rag.git
cd nexus-rag

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cd backend
cp .env.example .env
```

**`backend/.env`**
```env
# ── LLM (Required) ────────────────────────────────────────────
GROQ_API_KEY=gsk_your_key_here        # Free at console.groq.com

# ── ChromaDB ──────────────────────────────────────────────────
CHROMA_URL=http://localhost:8001      # Local ChromaDB URL
CHROMA_COLLECTION=research_papers

# ── Auth (Optional) ───────────────────────────────────────────
API_KEY=                              # Leave blank to disable auth in dev

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGIN=http://localhost:5173     # Comma-separated allowed origins

# ── Models ────────────────────────────────────────────────────
LLM_MODEL=llama-3.1-8b-instant
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2

# ── RAG Tuning ────────────────────────────────────────────────
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K=5
RERANK_TOP_K=3
MAX_FILE_SIZE_MB=50
```

**`frontend/.env`** (create this file)
```env
VITE_API_URL=                         # Leave blank for dev (uses Vite proxy)
VITE_API_KEY=                         # Leave blank if API_KEY not set on backend
```

### Running Locally

**Step 1 — Start ChromaDB**

With Python:
```bash
pip install chromadb
chroma run --host localhost --port 8001
```

With Docker:
```bash
docker run -p 8001:8000 chromadb/chroma:0.5.20
```

**Step 2 — Start the backend**
```bash
cd backend
npm run dev
# → http://localhost:3001
```

**Step 3 — Start the frontend**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📡 API Reference

All endpoints (except `/api/health`) require `X-API-Key` header if `API_KEY` env var is set.

### `GET /api/health`
Returns server status and ChromaDB chunk count.

```json
{
  "status": "healthy",
  "chunksStored": 423,
  "llmModel": "llama-3.1-8b-instant",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2"
}
```

---

### `POST /api/papers/upload`
Upload a PDF for ingestion. Accepts `multipart/form-data`.

| Field | Type | Description |
|---|---|---|
| `file` | File | PDF file (max 50 MB) |

**Response `201`**
```json
{
  "id": "uuid-v4",
  "filename": "paper.pdf",
  "title": "Attention Is All You Need",
  "authors": ["Vaswani, A.", "..."],
  "abstract": "We propose a new simple network...",
  "year": 2017,
  "totalPages": 15,
  "totalChunks": 87,
  "status": "ready",
  "uploadedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### `GET /api/papers`
Returns all uploaded papers.

---

### `DELETE /api/papers/:id`
Deletes a paper and all its vectors from ChromaDB.

---

### `POST /api/papers/:id/analyze`
Runs deep analysis on a paper.

**Body**
```json
{
  "analysisType": "summary"  // summary | methodology | contributions | limitations | future_work
}
```

---

### `POST /api/query`
Standard (non-streaming) RAG query.

**Body**
```json
{
  "question": "What datasets were used?",
  "paperIds": ["uuid1", "uuid2"],   // null = search all papers
  "topK": 5,                         // 1–20
  "useMMR": true,
  "useQueryExpansion": true,
  "useReranking": true
}
```

**Response**
```json
{
  "question": "What datasets were used?",
  "answer": "The study used **ImageNet** [Paper: ViT, Page: 4]...",
  "sources": [
    {
      "paperId": "uuid",
      "paperTitle": "ViT Paper",
      "filename": "vit.pdf",
      "page": 4,
      "content": "We trained on ImageNet-21k...",
      "relevanceScore": 0.92
    }
  ],
  "expandedQueries": ["Which benchmarks were evaluated?", "What training data was used?"],
  "confidence": 0.87,
  "processingTimeMs": 2341,
  "timings": {
    "expansion": 312,
    "retrieval": 445,
    "reranking": 891,
    "generation": 693
  }
}
```

---

### `POST /api/query/stream`
SSE streaming RAG query. Same request body as `/api/query`.

**Response** — `Content-Type: text/event-stream`

```
data: {"type":"meta","sources":[...],"confidence":0.87,"expandedQueries":[...],"timings":{...}}

data: {"type":"token","content":"The "}

data: {"type":"token","content":"study "}

data: {"type":"done","processingTimeMs":2341,"timings":{...}}
```

**Rate limits:** 15 requests/minute per IP on all query endpoints.

---

## 🖥️ Frontend

The frontend is a single-page React application with no routing.

### Key Components

| Component | File | Purpose |
|---|---|---|
| `App` | `App.jsx` | Root — all state, layout, event handlers |
| `ErrorBoundary` | `main.jsx` | Catches crashes, shows styled error UI |
| `Message` | `App.jsx` | Chat bubble — user or assistant, supports streaming cursor |
| `SourceCard` | `App.jsx` | Collapsible source snippet with relevance score |
| `ConfBar` | `App.jsx` | Animated confidence percentage bar |
| `PaperItem` | `App.jsx` | Paper card with checkbox, metadata, analysis buttons |
| `ConnectionDot` | `App.jsx` | 🟢/🔴/🟡 status indicator (polls `/api/health` every 30s) |
| `Toast` | `App.jsx` | Auto-dismissing notification system (replaces `alert()`) |

### State Management

| State | Hook | Description |
|---|---|---|
| `papers` | `usePapers` | List of uploaded papers from API |
| `selected` | `useState` (Set) | Paper IDs currently in scope for queries |
| `messages` | `useState` | Full chat history with streaming support |
| `querying` | `useState` | Whether a query is in flight |
| `cfg` | `useState` | Pipeline config (MMR, expansion, reranking, topK) |
| `toasts` | `useToasts` | Active toast notifications |
| `connectionStatus` | `useConnectionStatus` | Backend connectivity state |

### Streaming Flow

```
User sends question
    │
    ├── Empty assistant message added immediately (streaming: true)
    ├── SSE connection opened to /api/query/stream
    │
    ├── on "meta" event → sources + confidence panel rendered
    │   (appears before generation starts)
    │
    ├── on "token" events → content appended to message
    │   (blinking amber cursor visible while streaming)
    │
    └── on "done" event → streaming: false, timings updated
```

---

## 📦 Deployment

### Render (Backend + ChromaDB)

The `render.yaml` Blueprint deploys both services automatically.

**Steps:**
1. Go to [render.com](https://render.com) → **New +** → **Blueprint**
2. Connect your GitHub account and select `nexus-rag`
3. Click **Apply** — Render creates both services
4. In `nexus-rag-api` → **Environment** tab, manually set:
   - `GROQ_API_KEY` → your Groq API key
   - `CORS_ORIGIN` → your Vercel frontend URL (set after next step)

**Service URLs after deploy:**
- ChromaDB: `https://nexus-rag-chroma.onrender.com`
- API: `https://nexus-rag-api.onrender.com`

> **Note:** Free tier services spin down after 15 minutes of inactivity. First request after idle may take 30–60 seconds (cold start loads the 100MB embedding model).

---

### Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `nexus-rag` from GitHub
3. Set **Root Directory** → `frontend`
4. Add environment variable:
   - `VITE_API_URL` → `https://nexus-rag-api.onrender.com`
5. Click **Deploy**

**After deploy:**
- Copy your Vercel URL (e.g. `https://nexus-rag.vercel.app`)
- Go back to Render → `nexus-rag-api` → Environment
- Set `CORS_ORIGIN` → your Vercel URL
- Save — the service auto-restarts

---

## 🔒 Security

| Protection | Implementation |
|---|---|
| HTTP security headers | `helmet` middleware (CSP, HSTS, X-Frame-Options, X-XSS-Protection) |
| Rate limiting | `express-rate-limit` — 15 query/min, 10 upload/min per IP |
| API key auth | `X-API-Key` header or `Authorization: Bearer <key>` |
| Input validation | `zod` schemas on all endpoints — types, ranges, UUIDs |
| XSS prevention | `rehype-sanitize` on all LLM markdown output in the browser |
| CORS | Strict explicit allow-list only (no wildcards) |
| Error sanitization | Stack traces never sent to clients in production |
| File validation | Multer MIME-type check — PDF only, 50 MB max |
| Secrets management | `.env` in `.gitignore`, never committed |

---

## ⚡ Performance

| Optimization | Detail |
|---|---|
| Local embeddings | `all-MiniLM-L6-v2` runs on-server — zero embedding API cost |
| Model singleton | Embedding model loaded once per process (100 MB, cached) |
| Batch embedding | Texts embedded in batches of 100, not one-by-one |
| Parallel reranking | `Promise.all` — all rerank calls run simultaneously |
| SSE streaming | First token appears within ~500ms of retrieval completing |
| SQLite WAL mode | Concurrent reads never block writes |
| ChromaDB retry | 8 attempts × 5s — handles slow container cold start |

---

## 📄 File-by-File Breakdown

### Backend

| File | Lines | Responsibility |
|---|---|---|
| `server.js` | ~90 | Express app, middleware stack, boot sequence, graceful shutdown |
| `middleware/auth.js` | ~25 | API key validation, dev-mode bypass |
| `middleware/upload.js` | ~15 | Multer config, PDF-only MIME filter |
| `routes/health.js` | ~20 | Status endpoint for connection indicator and Render health checks |
| `routes/papers.js` | ~80 | Paper CRUD, upload trigger, analysis trigger, rate limiters |
| `routes/query.js` | ~90 | Standard + streaming query endpoints, Zod validation |
| `services/database.js` | ~80 | SQLite wrapper — schema init, CRUD, WAL mode |
| `services/chromaService.js` | ~55 | ChromaDB connection with 8-attempt retry, collection access |
| `services/llmService.js` | ~50 | Groq LLM factory, local embedder singleton |
| `services/ingestionService.js` | ~130 | PDF parsing, per-page extraction, chunking, batch embedding, ChromaDB upsert |
| `services/ragService.js` | ~220 | Query expansion, multi-query retrieval, MMR, LLM reranking, answer generation, streaming |
| `services/analysisService.js` | ~90 | Deep paper analysis (5 types) via context sampling |

### Frontend

| File | Lines | Responsibility |
|---|---|---|
| `main.jsx` | ~45 | React bootstrap, `ErrorBoundary` class component |
| `App.jsx` | ~500 | Entire UI — all components, state, event handlers |
| `hooks/usePapers.js` | ~40 | Paper list state, upload/remove with loading tracking |
| `utils/api.js` | ~65 | `fetch` wrapper, auth headers, `queryStream` SSE client |

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License.

---

<div align="center">

Built with ❤️ using Node.js, React, ChromaDB, and Groq

</div>
