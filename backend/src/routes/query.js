import { Router } from "express";
import { runRAGPipeline } from "../services/ragService.js";

const router = Router();

router.post("/", async (req, res, next) => {
    try {
        const {
            question,
            paperIds = null,
            topK = 5,
            useMMR = true,
            useQueryExpansion = true,
            useReranking = true,
        } = req.body;

        if (!question?.trim()) {
            return res.status(400).json({ error: "question is required" });
        }

        console.log(`\n[Query] "${question.slice(0, 80)}"`);
        const result = await runRAGPipeline({
            question,
            paperIds,
            topK,
            useMMR,
            useQueryExpansion,
            useReranking,
        });

        console.log(`[Query] Done in ${result.processingTimeMs}ms`);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;