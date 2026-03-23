# 🔬 Nexus RAG — AI Research Paper Analyzer

I built this project because reading through hundreds of pages of research papers is painful. 
Nexus RAG lets you upload any PDF and just *ask it questions* — like having a conversation 
with the paper itself.

## 🎬 What It Actually Does

Imagine you have a 50-page research paper. Instead of reading the whole thing, you just:

1. Upload the PDF
2. Ask "What is the main contribution of this paper?"
3. Get a detailed answer with citations like **[Paper: Attention Is All You Need, Page: 4]**

It tells you exactly where the answer came from, gives you a confidence score, and even 
shows you which paragraphs it used to generate the answer.

## 🧠 How It Works (The Interesting Part)

This isn't just "send the PDF to ChatGPT". It uses a technique called **RAG 
(Retrieval Augmented Generation)** — the same technique used by ChatGPT's file upload, 
Perplexity AI, and most enterprise AI tools.

Here's what happens when you ask a question:

**Step 1 — Query Expansion**
Your question gets rewritten into 2-3 different versions to improve search coverage.
"How does attention work?" becomes:
- "What is the mathematical formula for attention?"
- "How do query key value projections work?"

**Step 2 — Vector Search**
Each sentence in the paper was converted to a list of numbers (embeddings) that represent 
its meaning. Your question gets converted too, and we find the most mathematically similar 
paragraphs.

**Step 3 — MMR Re-ranking**
We apply Maximum Marginal Relevance to pick paragraphs that are both relevant AND diverse 
— so you don't get 5 copies of the same sentence.

**Step 4 — LLM Re-ranking**
The AI scores each paragraph 0-1 for true relevance to your question. Only the best ones 
make it through.

**Step 5 — Answer Generation**
The top paragraphs get sent to Groq's Llama model which writes a clear, cited answer.

## 🛠 Tech Stack

| What | Technology | Why I chose it |
|------|-----------|----------------|
| Frontend | React 18 + Vite | Fast, component-based, industry standard |
| Backend | Node.js + Express | JavaScript everywhere, simple REST API |
| LLM | Groq + Llama 3.1 8B | Free tier, insanely fast inference |
| Embeddings | @xenova/transformers | Runs locally in Node.js — zero API cost |
| Vector DB | ChromaDB | Simple, local, perfect for this use case |
| RAG Framework | LangChain.js | Makes chaining AI operations clean |

## ✨ Features

- 📄 **Upload any PDF** — drag and drop or click to upload
- 💬 **Natural language queries** — ask anything in plain English
- 📌 **Citations** — every answer shows exactly which page it came from
- 📊 **Confidence scores** — know how reliable the answer is
- 🔍 **Deep analysis modes** — Summary, Methodology, Contributions, Limitations, Future Work per paper
- ⚙️ **Pipeline controls** — toggle MMR, Query Expansion, Re-ranking on/off
- 🗂️ **Multi-paper support** — upload multiple papers and query across all of them

## 💰 Completely Free to Run

| Service | Cost |
|---------|------|
| Groq API (LLM) | Free — 14,400 requests/day |
| @xenova/transformers (embeddings) | Free — runs on your machine |
| ChromaDB (vector store) | Free — open source |
| Everything else | Free |

**Total monthly cost: $0**

## 🏃 Running It Locally

### What you need
- Node.js 20+
- Python 3.11
- A free Groq API key from [console.groq.com](https://console.groq.com)

### Step 1 — Clone the project
```bash
git clone https://github.com/Mdhummad/nexus-rag.git
cd nexus-rag
```

### Step 2 — Set up your API key
Create a file called `.env` inside the `backend` folder:
```
GROQ_API_KEY=your_groq_key_here
LLM_MODEL=llama-3.1-8b-instant
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
CHROMA_URL=http://localhost:8001
CHROMA_COLLECTION=research_papers
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### Step 3 — Start ChromaDB (the vector database)
```bash
py -3.11 -m uvicorn chromadb.app:app --host 0.0.0.0 --port 8001
```

### Step 4 — Start the backend
```bash
cd backend
npm install
npm run dev
```
First run downloads the embedding model (~25 MB). After that it's instant.

### Step 5 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```

### Step 6 — Open the app
Go to **http://localhost:5173** in your browser. Upload a PDF and start asking questions!

## 📡 API Reference
```
GET    /api/health                  Check if everything is running
POST   /api/papers/upload           Upload a PDF (multipart/form-data)
GET    /api/papers                  List all uploaded papers
DELETE /api/papers/:id              Delete a paper
POST   /api/papers/:id/analyze      Deep analysis (summary, methodology, etc.)
POST   /api/query                   Ask a question
```

### Query request example
```json
{
  "question": "How does multi-head attention work?",
  "paperIds": null,
  "topK": 5,
  "useMMR": true,
  "useQueryExpansion": true,
  "useReranking": true
}
```

## 🎯 What I Learned Building This

- How RAG pipelines actually work under the hood
- Vector embeddings and cosine similarity search
- Why naive "stuff everything in the context" approaches fail at scale
- LangChain.js for orchestrating multi-step AI workflows
- ChromaDB for storing and querying high-dimensional vectors
- Building a full REST API with Express and connecting it to a React frontend

## 🚀 Potential Improvements

- [ ] Stream responses word by word instead of waiting for full answer
- [ ] Add user authentication so multiple people can have their own paper libraries
- [ ] Switch to Pinecone for cloud-hosted vector storage
- [ ] Add support for other document types (Word, PowerPoint)
- [ ] Build a comparison mode to compare findings across multiple papers
```

Press **Ctrl+S**, then in the terminal run:
```
git add .
git commit -m "Add detailed README"
git push
