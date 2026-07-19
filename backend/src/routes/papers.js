import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ingestPaper } from "../services/ingestionService.js";
import { analyzePaper } from "../services/analysisService.js";
import { deleteByPaperId } from "../services/qdrantService.js";
import { insertPaper, getAllPapers, getPaperById, deletePaperById } from "../services/database.js";

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      10,
    message:  { error: "Too many uploads — please wait a moment." },
});

const analysisLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      20,
    message:  { error: "Too many analysis requests — please wait a moment." },
});

// ── Zod schema ────────────────────────────────────────────────────────────────
const AnalyzeSchema = z.object({
    analysisType: z.enum(
        ["summary", "methodology", "contributions", "limitations", "future_work"],
        { errorMap: () => ({ message: "analysisType must be one of: summary, methodology, contributions, limitations, future_work" }) }
    ),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        console.log(`\n[Upload] ${req.file.originalname}`);
        const paper = await ingestPaper(req.file.buffer, req.file.originalname);
        insertPaper(paper);   // atomic SQLite write
        res.status(201).json(paper);
    } catch (err) {
        next(err);
    }
});

router.get("/", (_req, res) => {
    res.json(getAllPapers());
});

router.get("/:id", (req, res) => {
    const paper = getPaperById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    res.json(paper);
});

router.delete("/:id", async (req, res, next) => {
    try {
        const paper = getPaperById(req.params.id);
        if (!paper) return res.status(404).json({ error: "Paper not found" });
        await deleteByPaperId(req.params.id);
        deletePaperById(req.params.id);   // atomic SQLite delete
        res.json({ message: `Deleted paper and its vector chunks` });
    } catch (err) {
        next(err);
    }
});

router.post("/:id/analyze", analysisLimiter, async (req, res, next) => {
    try {
        const paper = getPaperById(req.params.id);
        if (!paper) return res.status(404).json({ error: "Paper not found" });

        const parsed = AnalyzeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error:   "Invalid request",
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