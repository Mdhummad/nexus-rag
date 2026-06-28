# Nexus RAG — Deployment Tasks

## Backend Code Fixes
- [x] Fix papers.js: JSON file persistence (replace in-memory Map)
- [x] Update server.js: graceful shutdown + 50mb payload
- [x] Update chromaService.js: retry logic for production
- [x] Update backend .gitignore
- [x] Create backend/.env.example

## Deployment Config
- [x] Create render.yaml (Blueprint for ChromaDB + backend)
- [x] Create frontend/vercel.json
- [x] Update frontend/vite.config.js

## Feature Updates
- [x] Update App.jsx: connection status indicator, clear chat, upload filename feedback
- [x] Update usePapers.js: upload filename tracking

## Git & Deploy
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Deploy on Render (backend + ChromaDB)
- [ ] Deploy on Vercel (frontend)
- [ ] Verify health endpoint
