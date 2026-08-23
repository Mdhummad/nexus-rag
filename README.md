
<p align="center">
  <img src="frontend/public/logo.png" width="90" height="90" alt="Nexus RAG Logo" style="border-radius:18px"/>
</p>

<h1 align="center">NEXUS RAG</h1>

<p align="center">
  <strong>Ask your documents anything. Get answers that actually cite their sources.</strong><br/>
  <sub>Multi-query expansion · MMR diversity · LLM re-ranking · Real-time streaming</sub>
</p>

<p align="center">
  <a href="https://nexus-rag-alpha.vercel.app"><img src="https://img.shields.io/badge/LIVE%20DEMO-nexus--rag.vercel.app-f59e0b?style=for-the-badge&labelColor=09090b" alt="Live Demo"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.1-f59e0b?style=flat-square"/>
  <img src="https://img.shields.io/badge/Qdrant-Cloud-DC244C?style=flat-square"/>
  <img src="https://img.shields.io/badge/Deployed_on-Vercel_%2B_Render-000?style=flat-square&logo=vercel"/>
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square"/>
</p>

<br/>

---

<br/>

## The Problem

You have a 60-page research paper. You need one specific answer. You either read the whole thing or paste chunks into ChatGPT hoping for the best — and receive an answer with zero source references and unknown accuracy.

**Nexus RAG solves this properly.**

Upload any PDF. Ask a question. Get a precise, structured answer that tells you *exactly* which page of *exactly* which document it pulled from — streamed to you word-by-word, with a confidence score.

<br/>

---

<br/>

## How It Works

Most RAG systems do: embed → search → answer. That's one step.

Nexus runs **four intelligent stages** before generating a single word:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   YOUR QUESTION                                                     │
│        │                                                            │
│        ▼                                                            │
│   ① QUERY EXPANSION                                                 │
│        LLM rewrites your question 2 ways.                           │
│        Now you have 3 queries instead of 1.                         │
│        "What is attention?" also becomes                            │
│        "How does the attention mechanism work in transformers?"     │
│        │                                                            │
│        ▼                                                            │
│   ② MULTI-QUERY RETRIEVAL                                           │
│        All 3 queries hit Qdrant simultaneously.                     │
│        384-dimensional cosine similarity.                           │
│        Duplicates removed. Best candidates surfaced.                │
│        │                                                            │
│        ▼                                                            │
│   ③ MMR RE-RANKING  (Maximal Marginal Relevance)                    │
│        Removes chunks that say the same thing.                      │
│        Picks the most relevant AND most diverse set.               │
│        Your context window isn't wasted.                            │
│        │                                                            │
│        ▼                                                            │
│   ④ LLM RE-RANKING                                                  │
│        Groq scores each remaining chunk 0.0 → 1.0.                  │
│        All chunks scored in parallel.                               │
│        Only the best reach the answer stage.                        │
│        │                                                            │
│        ▼                                                            │
│   STREAMED ANSWER  ──────────────────────────────────────────────► │
│        Word by word. Cited inline. Confidence-scored.              │
│        Sources panel updates before the answer even starts.        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

<br/>

---

<br/>

## The Interface

Three panels. One purpose.

```
╔══════════════════╦═══════════════════════════════════╦══════════════════╗
║                  ║  ⚡ 5  │  📄 1000  │  □ 200         ║                  ║
║   YOUR PAPERS    ╠═══════════════════════════════════╣   SOURCES        ║
║                  ║                                   ║                  ║
║  ┌────────────┐  ║  You:                             ║  Confidence: 87% ║
║  │ • Paper 1  │  ║  ▸ What is self-attention?        ║  ─────────────── ║
║  │ • Paper 2  │  ║                                   ║  retrieval: 18ms ║
║  │ • Paper 3  │  ║  Nexus:                           ║  rerank:   340ms ║
║  └────────────┘  ║  Self-attention allows each       ║                  ║
║                  ║  position in a sequence to        ║  [1] Attention   ║
║  Drop PDFs or    ║  attend to all positions          ║  Paper · Page 4  ║
║  click to upload ║  [Source 1, Page 4]...▍           ║  92% match       ║
║                  ║                                   ║  ▼ see excerpt   ║
╚══════════════════╩═══════════════════════════════════╩══════════════════╝
```

**Left — Paper Sidebar**
Upload PDFs (drag & drop or click). Select specific papers to scope your search, or leave all selected to search everything. Papers show title, page count, and chunk count.

**Center — Chat**
Clean conversation view. Streaming answers appear word-by-word. A live pipeline indicator shows which stage is running. Copy button. Keyboard shortcuts.

**Top Strip — Live Controls**
Three sliders always visible: **Top-K** (chunks retrieved), **Chunk Size**, **Chunk Overlap**. Adjust before any query. The filled amber track shows your current value at a glance.

**Right — Sources Panel**
Appears automatically after any answer. Shows the confidence score, timing for each pipeline stage, expanded query variants, and collapsible source cards with excerpt previews.

<br/>

---

<br/>

## Stack

> Every choice here is deliberate. Nothing added for vanity.

| What | Tool | Why |
|------|------|-----|
| **LLM inference** | Groq (LLaMA 3.1-8b-instant) | Fastest available. Free tier is generous. |
| **Embeddings** | `@xenova/transformers` — all-MiniLM-L6-v2 | Runs inside Node.js. Zero API cost. ~50ms per chunk. |
| **Vector search** | Qdrant Cloud | Production-grade. Free 1GB cluster. Cosine similarity built in. |
| **Metadata** | SQLite + better-sqlite3 (WAL mode) | Zero-config. Concurrent-safe. No extra database to manage. |
| **PDF parsing** | pdf-parse | Extracts text per-page — so citations carry real page numbers. |
| **Chunking** | LangChain RecursiveCharacterTextSplitter | Splits at paragraph → sentence → word. Configurable from the UI. |
| **Frontend** | React 18 + Vite | Fast builds. SSE streaming just works. |
| **Backend** | Node.js 22 + Express.js | ESM, async-first, graceful shutdown on SIGTERM. |
| **Validation** | Zod | Every API input is schema-validated before touching anything. |
| **Security** | helmet + express-rate-limit | HSTS, CSP, X-Frame, 15 req/min limit. |
| **Hosting** | Vercel + Render | Both free tier. Zero DevOps. |

<br/>

---

<br/>

## Quick Start

### 1. Clone

```bash
git clone https://github.com/Mdhummad/nexus-rag.git
cd nexus-rag
```

### 2. Install

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Configure

Create `backend/.env`:

```env
# Required
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
QDRANT_URL=https://your-cluster.aws.cloud.qdrant.io
QDRANT_API_KEY=your_qdrant_key
QDRANT_COLLECTION=nexus_papers

# Optional
PORT=3001
CORS_ORIGIN=http://localhost:5173
API_KEY=                     # Leave empty to disable auth in dev
LLM_MODEL=llama-3.1-8b-instant
TOP_K=5
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

Get your free keys:
- **Groq** → [console.groq.com](https://console.groq.com) — no credit card
- **Qdrant** → [cloud.qdrant.io](https://cloud.qdrant.io) — free 1GB cluster

### 4. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Open http://localhost:5173
```

<br/>

---

<br/>

## Deploy

### Backend → Render (free)

| Field | Value |
|-------|-------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node src/server.js` |
| Health Check | `/api/health` |

Set these env vars in Render's dashboard:

```
GROQ_API_KEY      gsk_...
QDRANT_URL        https://your-cluster.aws.cloud.qdrant.io
QDRANT_API_KEY    your_key
CORS_ORIGIN       https://your-app.vercel.app
NODE_ENV          production
API_KEY           any_secret_string
```

### Frontend → Vercel (free)

| Field | Value |
|-------|-------|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |

Set this env var:

```
VITE_API_URL    https://your-backend.onrender.com
```

That's it. Push to `main` — both platforms auto-deploy.

<br/>

---

<br/>

## API

All endpoints except `/api/health` require `X-API-Key: your_key` header.

```
GET    /api/health                  → server status + chunk count
GET    /api/papers                  → list all uploaded papers
POST   /api/papers/upload           → upload PDF (multipart, field: "file")
GET    /api/papers/:id              → get one paper by ID
DELETE /api/papers/:id              → delete paper + all its vectors
POST   /api/papers/:id/analyze      → deep analysis of a paper
POST   /api/query                   → full RAG query (returns JSON)
POST   /api/query/stream            → full RAG query (returns SSE stream)
```

**Query body:**
```json
{
  "question": "What optimization algorithm does this paper propose?",
  "paperIds": null,
  "topK": 5,
  "useQueryExpansion": true,
  "useMMR": true,
  "useReranking": true
}
```

**Stream events arrive in this order:**
```
data: {"type":"meta",  "sources":[...], "confidence":0.91, "timings":{"expansion":210,"retrieval":18,"reranking":340}}
data: {"type":"token", "content":"The paper proposes "}
data: {"type":"token", "content":"Adam with decoupled "}
...
data: {"type":"done",  "processingTimeMs":3820}
```

**Analysis types** (`POST /api/papers/:id/analyze`):
```json
{ "analysisType": "summary" }
{ "analysisType": "methodology" }
{ "analysisType": "contributions" }
{ "analysisType": "limitations" }
{ "analysisType": "future_work" }
```

<br/>

---

<br/>

## Project Structure

```
nexus-rag/
│
├── backend/
│   ├── src/
│   │   ├── server.js                   ← entry point, middleware chain, graceful shutdown
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js                 ← X-API-Key header check
│   │   │   └── upload.js               ← multer, PDF-only, 50MB cap, memoryStorage
│   │   │
│   │   ├── routes/
│   │   │   ├── health.js               ← GET /api/health (public)
│   │   │   ├── papers.js               ← upload, list, get, delete, analyze
│   │   │   └── query.js                ← standard query + SSE stream
│   │   │
│   │   └── services/
│   │       ├── ingestionService.js     ← PDF → pages → chunks → embed → Qdrant
│   │       ├── ragService.js           ← expand → retrieve → MMR → rerank → stream
│   │       ├── qdrantService.js        ← upsert, search, delete by paperId
│   │       ├── llmService.js           ← Groq client + local embedding model
│   │       ├── analysisService.js      ← 5 deep analysis types
│   │       └── database.js             ← SQLite WAL, paper metadata CRUD
│   │
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── logo.png
│   ├── src/
│   │   ├── App.jsx                     ← entire UI: 3-panel, streaming, sliders
│   │   ├── hooks/
│   │   │   └── usePapers.js            ← paper list state + reload trigger
│   │   └── utils/
│   │       └── api.js                  ← fetch wrapper + SSE ReadableStream reader
│   └── vite.config.js
│
├── render.yaml                         ← Render deployment config
└── README.md
```

<br/>

---

<br/>

## Security

Nothing exposed that shouldn't be.

- **Auth** — `X-API-Key` header on all routes except `/api/health`. Dev mode if `API_KEY` env is unset.
- **Rate limiting** — 15 queries/min, 10 uploads/min, 20 analysis/min — per IP.
- **Helmet** — sets CSP, HSTS, X-Frame-Options, X-Content-Type on every response.
- **CORS** — strict allowlist. No wildcard. Configurable via `CORS_ORIGIN`.
- **Zod** — every request body is schema-validated before any processing begins.
- **XSS** — all LLM markdown output is sanitized with `rehype-sanitize` before render.
- **Secrets** — nothing hardcoded. All via environment variables.
- **Stack traces** — never leaked to clients in `NODE_ENV=production`.

<br/>

---

<br/>

## Known Limits

These are intentional tradeoffs for the free-tier deployment target:

- **Cold starts on Render** — free tier sleeps after 15 min idle. First request takes ~30s to wake up. Qdrant retries handle this.
- **Embedding model load** — `all-MiniLM-L6-v2` downloads ~23MB on first start, then stays in RAM. Only happens once per deployment.
- **No auth system** — there's a single shared API key, not per-user accounts. Add a proper auth layer if building multi-tenant.
- **SQLite not distributed** — works perfectly on a single Render instance. If you scale horizontally, switch to Postgres.
- **PDF text only** — scanned PDFs (image-based) won't extract text. Use a PDF with embedded text.

<br/>

---

<br/>

## License

MIT © [Mdhummad](https://github.com/Mdhummad),[Daniyalkhan](https://github.com/daniwinsss) ·

<br/>

<p align="center">
  <sub>Built with Groq · Qdrant · React · Node.js</sub>
</p>
