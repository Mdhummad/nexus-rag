import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { ingestPaper } from "../services/ingestionService.js";
import { analyzePaper } from "../services/analysisService.js";
import { deleteByPaperId } from "../services/chromaService.js";

const router = Router();
const papers = new Map();

router.post("/upload", upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        console.log(`\n[Upload] ${req.file.originalname}`);
        const paper = await ingestPaper(req.file.buffer, req.file.originalname);
        papers.set(paper.id, paper);
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