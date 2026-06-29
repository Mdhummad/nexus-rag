import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ingestPaper } from "../services/ingestionService.js";
import { analyzePaper } from "../services/analysisService.js";
import { deleteByPaperId } from "../services/chromaService.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const PAPERS_FILE = join(DATA_DIR, "papers.json");

// ── Async file-based paper store ──────────────────────────────────────────────
async function ensureDataDir() {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

async function loadPapers() {
    try {
        await ensureDataDir();
        if (existsSync(PAPERS_FILE)) {
            const raw = await readFile(PAPERS_FILE, "utf-8");
            return new Map(JSON.parse(raw));
        }
    } catch (e) {
        console.warn("[papers] Could not load papers.json, starting fresh:", e.message);
    }
    return new Map();
}

async function savePapers(papersMap) {
    try {
        await ensureDataDir();
        await writeFile(PAPERS_FILE, JSON.stringify([...papersMap.entries()]), "utf-8");
    } catch (e) {
        console.error("[papers] Failed to save papers.json:", e.message);
    }
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many uploads — please wait a moment." },
});

const analysisLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: "Too many analysis requests — please wait a moment." },
});

// ── Zod schemas ───────────────────────────────────────────────────────────────
const AnalyzeSchema = z.object({
    analysisType: z.enum(
        ["summary", "methodology", "contributions", "limitations", "future_work"],
        { errorMap: () => ({ message: "analysisType must be one of: summary, methodology, contributions, limitations, future_work" }) }
    ),
});

const router = Router();

// Bootstrap — load persisted papers on startup
const papers = await loadPapers();
console.log(`[papers] Loaded ${papers.size} paper(s) from disk`);

router.post("/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        console.log(`\n[Upload] ${req.file.originalname}`);
        const paper = await ingestPaper(req.file.buffer, req.file.originalname);
        papers.set(paper.id, paper);
        await savePapers(papers);   // async write — doesn't block event loop
        res.status(201).json(paper);
    } catch (err) {
        next(err);
    }
});

router.get("/", (_req, res) => {
    res.json([...papers.values()]);
});

router.get("/:id", (req, res) => {
    const paper = papers.get(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    res.json(paper);
});

router.delete("/:id", async (req, res, next) => {
    try {
        if (!papers.has(req.params.id)) {
            return res.status(404).json({ error: "Paper not found" });
        }
        const deleted = await deleteByPaperId(req.params.id);
        papers.delete(req.params.id);
        await savePapers(papers);   // async write
        res.json({ message: `Deleted paper and ${deleted} chunks` });
    } catch (err) {
        next(err);
    }
});

router.post("/:id/analyze", analysisLimiter, async (req, res, next) => {
    try {
        if (!papers.has(req.params.id)) {
            return res.status(404).json({ error: "Paper not found" });
        }

        const parsed = AnalyzeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
            });
        }

        const result = await analyzePaper(req.params.id, parsed.data.analysisType);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;