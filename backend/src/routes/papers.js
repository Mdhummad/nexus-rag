import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { ingestPaper } from "../services/ingestionService.js";
import { analyzePaper } from "../services/analysisService.js";
import { deleteByPaperId } from "../services/chromaService.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const PAPERS_FILE = join(DATA_DIR, "papers.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadPapers() {
    try {
        if (existsSync(PAPERS_FILE)) {
            return new Map(JSON.parse(readFileSync(PAPERS_FILE, "utf-8")));
        }
    } catch (e) {
        console.warn("[papers] Could not load papers.json, starting fresh:", e.message);
    }
    return new Map();
}

function savePapers(papersMap) {
    try {
        writeFileSync(PAPERS_FILE, JSON.stringify([...papersMap.entries()]), "utf-8");
    } catch (e) {
        console.error("[papers] Failed to save papers.json:", e.message);
    }
}

const router = Router();
const papers = loadPapers();

console.log(`[papers] Loaded ${papers.size} paper(s) from disk`);

router.post("/upload", upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        console.log(`\n[Upload] ${req.file.originalname}`);
        const paper = await ingestPaper(req.file.buffer, req.file.originalname);
        papers.set(paper.id, paper);
        savePapers(papers);
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
        savePapers(papers);
        res.json({ message: `Deleted paper and ${deleted} chunks` });
    } catch (err) {
        next(err);
    }
});

router.post("/:id/analyze", async (req, res, next) => {
    try {
        if (!papers.has(req.params.id)) {
            return res.status(404).json({ error: "Paper not found" });
        }
        const { analysisType } = req.body;
        if (!analysisType) return res.status(400).json({ error: "analysisType is required" });
        const result = await analyzePaper(req.params.id, analysisType);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;