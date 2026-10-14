import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { initQdrant } from "./services/qdrantService.js";
import { getDb } from "./services/database.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { getEmbeddings } from "./services/llmService.js";
import papersRouter from "./routes/papers.js";
import queryRouter  from "./routes/query.js";
import healthRouter from "./routes/health.js";


const app  = express();
const PORT = process.env.PORT || 3001;

// ── Trust proxy — required on Render/Vercel (sits behind reverse proxy) ───────
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());


// ── CORS — strict explicit allow-list only ────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];

app.use(cors({
    origin: (origin, cb) => {
        // Allow requests with no origin (Render health checks, curl, mobile)
        if (!origin) return cb(null, true);
        // Allow all Vercel deployments (production + preview branches)
        if (origin.endsWith(".vercel.app")) return cb(null, true);
        // Allow localhost for dev
        if (origin.startsWith("http://localhost:")) return cb(null, true);
        // Allow any explicitly listed origins
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
}));


// ── Body parsing — conservative limits ───────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ── Routes (auth applied to all except health) ────────────────────────────────
app.use("/api/health", healthRouter);                    // health is public
app.use("/api/papers", apiKeyAuth, papersRouter);
app.use("/api/query",  apiKeyAuth, queryRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("[Error]", err.message);
    // Never leak stack traces to clients in production
    const isProd = process.env.NODE_ENV === "production";
    res.status(err.status || 500).json({
        error: isProd ? "Internal server error" : (err.message || "Internal server error"),
    });
});

let server;

async function boot() {
    try {
        console.log("\n╔══════════════════════════════════════╗");
        console.log("║  NEXUS RAG — Node.js Backend          ║");
        console.log("╚══════════════════════════════════════╝\n");

        console.log("[1/3] Initializing SQLite...");
        getDb();
        console.log("      SQLite ready ✓");

        console.log("[2/3] Initializing Qdrant...");
        await initQdrant();
        console.log("      Qdrant ready ✓");

        server = app.listen(PORT, () => {
            console.log(`\n[3/3] Server running → http://localhost:${PORT}`);
            console.log(`      Health check  → http://localhost:${PORT}/api/health`);
            console.log(`      Auth          → ${process.env.API_KEY ? "enabled (X-API-Key)" : "disabled (dev mode)"}`);
            console.log(`      LLM model     → ${process.env.LLM_MODEL || "openai/gpt-oss-20b"} (Groq)`);
            console.log(`      Embed model   → ${process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2"} (local)\n`);

            // Pre-warm embedding model in background — server is already accepting requests
            console.log("[bg] Pre-warming embedding model...");
            getEmbeddings().embedQuery("warmup")
                .then(() => console.log("[bg] Embedding model ready ✓"))
                .catch((e) => console.warn("[bg] Embedding pre-warm failed:", e.message));
        });
    } catch (err) {
        console.error("Boot failed:", err);
        process.exit(1);
    }
}

// ── Graceful shutdown for Render SIGTERM ──────────────────────────────────────
function shutdown(signal) {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    server?.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

boot();
