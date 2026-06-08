import "dotenv/config";
import express from "express";
import cors from "cors";
import { initChroma } from "./services/chromaService.js";
import papersRouter from "./routes/papers.js";
import queryRouter from "./routes/query.js";
import healthRouter from "./routes/health.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",") || [
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.use("/api/health", healthRouter);
app.use("/api/papers", papersRouter);
app.use("/api/query", queryRouter);

app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});

app.use((err, _req, res, _next) => {
    console.error("[Error]", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error",
    });
});

async function boot() {
    try {
        console.log("\n╔══════════════════════════════════════╗");
        console.log("║  NEXUS RAG — Node.js Backend          ║");
        console.log("╚══════════════════════════════════════╝\n");

        console.log("[1/2] Initializing ChromaDB...");
        await initChroma();
        console.log("      ChromaDB ready ✓");

        app.listen(PORT, () => {
            console.log(`\n[2/2] Server running → http://localhost:${PORT}`);
            console.log(`      Health check  → http://localhost:${PORT}/api/health`);
            console.log(`      LLM model     → ${process.env.LLM_MODEL || "llama-3.1-8b-instant"} (Groq)`);
            console.log(`      Embed model   → ${process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2"} (local)\n`);
        });
    } catch (err) {
        console.error("Boot failed:", err);
        process.exit(1);
    }
}

boot();