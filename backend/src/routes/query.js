import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { runRAGPipeline, runRAGPipelineStream } from "../services/ragService.js";

const router = Router();

// ── Rate limiter: 15 queries per minute per IP ────────────────────────────────
const queryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many queries — please wait a moment before trying again." },
});

// ── Shared Zod schema ─────────────────────────────────────────────────────────
const QuerySchema = z.object({
    question: z
        .string({ required_error: "question is required" })
        .min(1, "question cannot be empty")
        .max(2000, "question must be 2000 characters or fewer")
        .trim(),
    paperIds: z
        .array(z.string().uuid("Each paperId must be a valid UUID"))
        .max(50)
        .nullable()
        .optional()
        .default(null),
    topK: z.number().int().min(1).max(20).optional().default(5),
    useMMR:             z.boolean().optional().default(true),
    useQueryExpansion:  z.boolean().optional().default(true),
    useReranking:       z.boolean().optional().default(true),
});

// ── POST /api/query — standard (non-streaming) ────────────────────────────────
router.post("/", queryLimiter, async (req, res, next) => {
    try {
        const parsed = QuerySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
            });
        }

        const { question, paperIds, topK, useMMR, useQueryExpansion, useReranking } = parsed.data;
        console.log(`\n[Query] "${question.slice(0, 80)}"`);

        const result = await runRAGPipeline({ question, paperIds, topK, useMMR, useQueryExpansion, useReranking });
        console.log(`[Query] Done in ${result.processingTimeMs}ms`);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/query/stream — SSE streaming ────────────────────────────────────
// SSE event format:
//   data: {"type":"meta",  "expandedQueries":[...], "sources":[...], "confidence":0.85, "timings":{...}}
//   data: {"type":"token", "content":"Hello "}
//   data: {"type":"done",  "processingTimeMs":1234}
//   data: {"type":"error", "message":"..."}
router.post("/stream", queryLimiter, async (req, res) => {
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        });
    }

    const { question, paperIds, topK, useMMR, useQueryExpansion, useReranking } = parsed.data;
    console.log(`\n[Stream] "${question.slice(0, 80)}"`);

    // ── SSE headers ───────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");    // disable nginx buffering
    res.flushHeaders();

    // Helper: write a typed SSE event
    const emit = (type, payload = {}) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    };

    // Heartbeat to prevent proxy timeout (every 15s)
    const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(": heartbeat\n\n");
    }, 15_000);

    // Cleanup when client disconnects
    req.on("close", () => {
        clearInterval(heartbeat);
    });

    try {
        await runRAGPipelineStream({
            question, paperIds, topK, useMMR, useQueryExpansion, useReranking,
            emit,
        });
    } catch (err) {
        console.error("[Stream] Error:", err.message);
        emit("error", { message: err.message });
    } finally {
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
        console.log(`[Stream] Closed`);
    }
});

export default router;