<div align="center">

# ⚡ Nexus RAG

### Intelligent Document Q&A — Powered by Groq & Qdrant

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant_Cloud-Vector_DB-DC244C?style=flat-square)](https://cloud.qdrant.io)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.1-F55036?style=flat-square)](https://console.groq.com)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend-000?style=flat-square&logo=vercel)](https://vercel.com)
[![Render](https://img.shields.io/badge/Render-Backend-46E3B7?style=flat-square)](https://render.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Upload any PDF → Ask questions → Get streamed, cited answers in real time**

[🚀 Live Demo](https://nexus-rag-alpha.vercel.app) · [🐛 Report Bug](https://github.com/Mdhummad/nexus-rag/issues)

</div>

---

## 🧠 What Is Nexus RAG?

**Nexus RAG** is a full-stack, production-ready **Retrieval-Augmented Generation (RAG)** system. Upload any PDF — research papers, reports, books, resumes — and ask complex questions across all of them. You get detailed, inline-cited answers grounded exclusively in your documents, streamed word-by-word in real time.

The system implements a **multi-stage intelligent pipeline** far beyond simple vector search:

```
Your Question
    │
    ├─► Query Expansion       LLM generates 2 semantic reformulations → 3 queries total
    │
    ├─► Multi-Query Retrieval  All 3 queries searched in Qdrant Cloud simultaneously
    │
    ├─► MMR Re-ranking         Maximal Marginal Relevance removes redundant chunks
    │
    ├─► LLM Re-ranking         Groq scores each chunk 0.0–1.0 for relevance (parallel)
    │
    └─► Streaming Answer       Groq streams a cited, structured answer via SSE
```

---

## ✨ Key Features

| Category | Feature |
|----------|---------|
| **RAG Pipeline** | Multi-query expansion · MMR diversity · LLM re-ranking · SSE streaming |
| **UI** | 3-panel layout (Sidebar · Chat · Sources) · Amber dark theme · Real-time pipeline steps |
| **Citations** | Inline `[Source N, Page P]` with real page numbers from PDF |
| **Confidence** | Calibrated 0–100% confidence score per answer |
| **Embeddings** | `all-MiniLM-L6-v2` via `@xenova/transformers` — **on-server, zero API cost** |
| **Vector DB** | **Qdrant Cloud** — free 1GB, cosine similarity, production-grade |
| **Metadata** | LLM auto-extracts title, authors, year, abstract on upload |
| **Storage** | SQLite (WAL mode) for paper metadata — zero-config, concurrent-safe |
| **Security** | API key auth · Rate limiting · Helmet · Zod validation · XSS protection |
| **Deploy** | Vercel (frontend) + Render (backend) — **both free tier** |

---

## 🖥️ UI Overview

The interface has **3 panels** and a **live configuration strip**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ☰  NEXUS RAG            Intelligent document Q&A    [Sources] [Clear]  │
├──────────────────┬─────────────────────────┬──────────────────────────┤
│  ⚡ Top-K: 5    │  📄 Chunk Size: 1000    │  ≡ Chunk Overlap: 200    │
│  ════●══════    │  ════════●══════════    │  ══●════════════════     │
├──────────┬───────┴─────────────────────────┴──────────────────────────┤
│          │                                          │                  │
│ PAPERS   │         CHAT MESSAGES                   │  SOURCES PANEL   │
│          │  User ─────────────────────────────►    │  Confidence bar  │
│ Upload   │                                          │  Timing badges   │
│ zone     │  ◉ Nexus ──────────────────────────     │  Query expansions│
│          │    Streamed answer with markdown...      │  Source cards    │
│ Paper 1  │    [Source 1, Page 4] ...               │  ─ Paper title   │
│ Paper 2  │                                          │    Page 3 · 92%  │
│          │                                          │    ▼ excerpt     │
├──────────┴─────────────────────────────────────────┴──────────────────┤
│  [ Ask anything about your documents...                      ] [Send]  │
└────────────────────────────────────────────────────────────────────────┘
```

**Slider bar (always visible at top):**
- **Top-K** — how many chunks retrieved per query
- **Chunk Size** — characters per text chunk (applies on next upload)
- **Chunk Overlap** — overlap between consecutive chunks

**Pipeline is always fully enabled:** Query Expansion + MMR + LLM Re-ranking run on every query.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser  (Vercel)                        │
│                                                              │
│   Sidebar              Chat Area           Sources Panel     │
│   • Upload PDFs        • SSE streaming     • Confidence bar  │
│   • Select scope       • Markdown render   • Source cards    │
│   • Paper list         • Pipeline steps    • Query expansions│
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS (Fetch / SSE)
┌────────────────────────────▼─────────────────────────────────┐
│                  Node.js Backend  (Render)                   │
│                                                              │
│  Express.js · helmet · cors · express-rate-limit · zod       │
│                                                              │
│  POST /api/papers/upload    → PDF ingestion pipeline         │
│  GET  /api/papers           → list all papers                │
│  DELETE /api/papers/:id     → delete paper + vectors         │
│  POST /api/papers/:id/analyze → deep analysis (5 types)      │
│  POST /api/query            → standard RAG query             │
│  POST /api/query/stream     → SSE streaming RAG query        │
│  GET  /api/health           → health check (public)          │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  ragService │  │ingestionSvc  │  │  analysisService  │   │
│  │             │  │              │  │                   │   │
│  │ • Expansion │  │ • pdf-parse  │  │ • summary         │   │
│  │ • Retrieval │  │ • LLM meta   │  │ • methodology     │   │
│  │ • MMR       │  │ • Chunking   │  │ • contributions   │   │
│  │ • Reranking │  │ • Embedding  │  │ • limitations     │   │
│  │ • Streaming │  │ • Qdrant     │  │ • future_work     │   │
│  └─────────────┘  └──────────────┘  └───────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │
          ┌──────────────────┴────────────────┐
          │                                   │
   ┌──────▼──────┐                   ┌────────▼───────┐
   │ Qdrant Cloud│                   │ SQLite (local) │
   │ (Vectors)   │                   │ (Paper meta)   │
   │  384-dim    │                   │  WAL mode      │
   └─────────────┘                   └────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + Vite | SSE streaming, amber dark theme |
| **Backend** | Node.js 22 + Express.js | ESM modules, graceful shutdown |
| **LLM** | Groq (LLaMA 3.1-8b-instant) | Fastest free inference |
| **Embeddings** | `@xenova/transformers` (all-MiniLM-L6-v2) | On-server, no API cost |
| **Vector DB** | **Qdrant Cloud** | Free 1GB cluster, cosine similarity |
| **Metadata DB** | better-sqlite3 (WAL mode) | Zero-config, concurrent-safe |
| **PDF parsing** | pdf-parse | Real per-page text extraction |
| **Chunking** | LangChain RecursiveCharacterTextSplitter | Configurable size/overlap |
| **Validation** | Zod | Schema-validated API inputs |
| **Security** | helmet + express-rate-limit | CSP, HSTS, rate limits |
| **Deploy** | Vercel + Render | Both free tier |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- Free [Qdrant Cloud](https://cloud.qdrant.io) account (no credit card)
- Free [Groq](https://console.groq.com) API key

### Installation

```bash
# Clone the repo
git clone https://github.com/Mdhummad/nexus-rag.git
cd nexus-rag

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
GROQ_API_KEY=gsk_your_key_here
QDRANT_URL=https://your-cluster.us-west-1-0.aws.cloud.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=research_papers
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

### Running Locally

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
# Open http://localhost:5173
```

---

## ☁️ Deployment

### Backend → Render

1. Connect your GitHub repo to [Render](https://render.com)
2. New Web Service → Root Dir: `backend` → Build: `npm install` → Start: `node src/server.js`
3. Add environment variables in Render dashboard:
   ```
   GROQ_API_KEY=gsk_...
   QDRANT_URL=https://your-cluster.aws.cloud.qdrant.io
   QDRANT_API_KEY=your_key
   CORS_ORIGIN=https://your-frontend.vercel.app
   NODE_ENV=production
   ```

### Frontend → Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Root Dir: `frontend`
3. Add environment variable:
   ```
   VITE_API_URL=https://your-render-backend.onrender.com
   ```
4. Deploy — Vercel handles the build automatically

### Health Check

```
GET https://your-backend.onrender.com/api/health
→ { "status": "healthy", "vectorStore": "qdrant", "chunksStored": 0, ... }
```

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/api/health`              | ❌ Public | Health check |
| `GET`    | `/api/papers`              | ✅ Key | List all papers |
| `POST`   | `/api/papers/upload`       | ✅ Key | Upload PDF (`multipart/form-data`, field: `file`) |
| `GET`    | `/api/papers/:id`          | ✅ Key | Get paper by ID |
| `DELETE` | `/api/papers/:id`          | ✅ Key | Delete paper + all vectors |
| `POST`   | `/api/papers/:id/analyze`  | ✅ Key | Deep analysis (`{ analysisType }`) |
| `POST`   | `/api/query`               | ✅ Key | Standard RAG query |
| `POST`   | `/api/query/stream`        | ✅ Key | SSE streaming RAG query |

**Query body:**
```json
{
  "question": "What is the main contribution?",
  "paperIds": ["uuid1", "uuid2"],
  "topK": 5,
  "useQueryExpansion": true,
  "useMMR": true,
  "useReranking": true
}
```

**SSE stream events:**
```
data: {"type":"meta",  "sources":[...], "confidence":0.87, "timings":{...}}
data: {"type":"token", "content":"Hello "}
data: {"type":"done",  "processingTimeMs":4321}
data: {"type":"error", "message":"..."}
```

---

## 🔒 Security

- **API key auth** via `X-API-Key` header (optional — dev mode if unset)
- **Rate limiting** — 15 queries/min, 10 uploads/min per IP
- **Helmet** — CSP, HSTS, X-Frame-Options, X-Content-Type
- **Zod validation** — all request bodies schema-validated before processing
- **CORS** — strict allowlist only, no wildcard
- **XSS protection** — `rehype-sanitize` on all LLM markdown output
- **No secrets in code** — all via environment variables

---

## ⚡ Performance

| Metric | Value |
|--------|-------|
| Embedding model | 384-dim, ~50ms per chunk, on-server |
| Query expansion | +2 reformulations via LLaMA 3.1 |
| Qdrant search | ~20ms cosine similarity |
| LLM re-ranking | Parallel scoring (Promise.all) |
| Full pipeline | ~3–8s end-to-end (streaming starts ~2s) |
| Max PDF size | 50MB |
| Default chunk size | 1000 chars / 200 overlap (configurable in UI) |

---

## 📁 Project Structure

```
nexus-rag/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express app, boot sequence, graceful shutdown
│   │   ├── middleware/
│   │   │   ├── auth.js            # API key authentication
│   │   │   └── upload.js          # Multer — memory storage, PDF validation
│   │   ├── routes/
│   │   │   ├── health.js          # GET /api/health
│   │   │   ├── papers.js          # Paper CRUD + upload + analysis
│   │   │   └── query.js           # RAG query (standard + SSE stream)
│   │   └── services/
│   │       ├── qdrantService.js   # Qdrant Cloud — upsert & cosine search
│   │       ├── ragService.js      # Full pipeline: expand→retrieve→MMR→rerank→stream
│   │       ├── ingestionService.js# PDF parse → chunk → embed → Qdrant
│   │       ├── llmService.js      # Groq LLM factory + local embedding model
│   │       ├── analysisService.js # Deep paper analysis (5 types)
│   │       └── database.js        # SQLite paper metadata (WAL mode)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── logo.png               # App logo
│   ├── src/
│   │   ├── App.jsx                # Full UI: 3-panel layout, streaming, sliders
│   │   ├── hooks/
│   │   │   └── usePapers.js       # Paper list state + reload
│   │   └── utils/
│   │       └── api.js             # API client + SSE stream reader
│   ├── vite.config.js
│   └── package.json
├── render.yaml                    # Render deployment config
└── README.md
```

---

## 🤝 Contributing

Pull requests welcome! Please open an issue first to discuss what you'd like to change.

---

## 📄 License

MIT © [Mdhummad](https://github.com/Mdhummad) · [Vaibhavxlegend](https://github.com/VaibhavxLegend)
