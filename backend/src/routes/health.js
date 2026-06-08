import { Router } from "express";
import { getChunkCount } from "../services/chromaService.js";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        const chunks = await getChunkCount();
        res.json({
            status: "healthy",
            chunksStored: chunks,
            llmModel: process.env.LLM_MODEL || "llama-3.1-8b-instant",
            embeddingModel: process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2",
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(503).json({ status: "degraded", error: err.message });
    }
});

export default router;