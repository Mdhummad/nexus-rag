import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { runRAGPipeline } from "../services/ragService.js";

const router = Router();

// ── Rate limiter: max 15 queries per minute per IP ────────────────────────────
const queryLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many queries — please wait a moment before trying again." },
});

// ── Zod schema ────────────────────────────────────────────────────────────────
const QuerySchema = z.object({
    question: z
        .string({ required_error: "question is required" })
        .min(1, "question cannot be empty")
        .max(2000, "question must be 2000 characters or fewer")
        .trim(),
    paperIds: z
        .array(z.string().uuid("Each paperId must be a valid UUID"))
        .max(50, "Cannot scope more than 50 papers at once")
        .nullable()
        .optional()
        .default(null),
    topK: z
        .number()
        .int()
        .min(1, "topK must be at least 1")
        .max(20, "topK cannot exceed 20")
        .optional()
        .default(5),
    useMMR: z.boolean().optional().default(true),
    useQueryExpansion: z.boolean().optional().default(true),
    useReranking: z.boolean().optional().default(true),
});

router.post("/", queryLimiter, async (req, res, next) => {
    try {
        // ── Validate & parse input ────────────────────────────────────────────
        const parsed = QuerySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            });
        }

        const { question, paperIds, topK, useMMR, useQueryExpansion, useReranking } = parsed.data;

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