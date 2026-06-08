import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getLLM, getEmbeddings } from "./llmService.js";
import { getCollection } from "./chromaService.js";

const TOP_K = parseInt(process.env.TOP_K) || 5;
const RERANK_TOP_K = parseInt(process.env.RERANK_TOP_K) || 3;

const EXPANSION_PROMPT = ChatPromptTemplate.fromTemplate(`
You are an expert at reformulating research questions for better document retrieval.
Generate 2 semantically different reformulations of this question.

Question: {question}

Return ONLY a JSON array of 2 strings. Example: ["reformulation 1", "reformulation 2"]
No explanation, no markdown:`);

export async function expandQuery(question) {
    try {
        const llm = getLLM({ temperature: 0.3 });
        const chain = EXPANSION_PROMPT.pipe(llm).pipe(new StringOutputParser());
        const raw = await chain.invoke({ question });
        const cleaned = raw.replace(/```(?:json)?|```/g, "").trim();
        const expansions = JSON.parse(cleaned);
        return [question, ...expansions];
    } catch {
        return [question];
    }
}

function cosineSim(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

export function mmrRerank(queryEmbedding, candidates, topK, lambda = 0.5) {
    if (!candidates.length) return [];
    const selected = [];
    const remaining = [...candidates];

    while (selected.length < topK && remaining.length > 0) {
        let bestScore = -Infinity;
        let bestIdx = 0;

        for (let i = 0; i < remaining.length; i++) {
            const relevance = cosineSim(queryEmbedding, remaining[i].embedding);
            const redundancy = selected.length === 0
                ? 0
                : Math.max(...selected.map((s) => cosineSim(remaining[i].embedding, s.embedding)));
            const score = lambda * relevance - (1 - lambda) * redundancy;
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }

        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
    }
    return selected;
}

const RERANK_PROMPT = ChatPromptTemplate.fromTemplate(`
Rate how relevant this passage is to the question on a scale 0.0 to 1.0.

Question: {question}
Passage: {passage}

Return ONLY JSON: {{"score": <float>}}
No explanation:`);

export async function llmRerank(question, chunks, topK) {
    const llm = getLLM({ temperature: 0 });
    const chain = RERANK_PROMPT.pipe(llm).pipe(new StringOutputParser());

    const scored = await Promise.all(
        chunks.map(async (chunk) => {
            try {
                const raw = await chain.invoke({
                    question,
                    passage: chunk.content.slice(0, 600),
                });
                const { score } = JSON.parse(raw.replace(/```(?:json)?|```/g, "").trim());
                return { ...chunk, rerankScore: parseFloat(score) || 0.5 };
            } catch {
                return { ...chunk, rerankScore: chunk.distanceScore || 0.5 };
            }
        })
    );

    return scored.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topK);
}

export async function retrieveChunks(question, queries, paperIds, topK, useMMR) {
    const collection = getCollection();
    const embedder = getEmbeddings();

    const where = paperIds?.length
        ? { paper_id: { $in: paperIds } }
        : undefined;

    const seen = new Set();
    const allChunks = [];

    for (const q of queries) {
        const qEmb = await embedder.embedQuery(q);
        const results = await collection.query({
            queryEmbeddings: [qEmb],
            nResults: Math.min(topK * 2, 20),
            include: ["documents", "metadatas", "distances"],
        });

        const docs = results.documents[0];
        const metas = results.metadatas[0];
        const dists = results.distances[0];

        for (let i = 0; i < docs.length; i++) {
            const chunkId = metas[i].chunk_id;
            if (!seen.has(chunkId)) {
                seen.add(chunkId);
                allChunks.push({
                    chunkId,
                    content: docs[i],
                    metadata: metas[i],
                    distanceScore: 1 - dists[i],
                    embedding: [],
                });
            }
        }
    }

    allChunks.sort((a, b) => b.distanceScore - a.distanceScore);

    if (useMMR && allChunks.length > topK) {
        const qEmb = await embedder.embedQuery(question);
        return mmrRerank(qEmb, allChunks, topK * 2);
    }

    return allChunks.slice(0, topK * 2);
}

const ANSWER_PROMPT = ChatPromptTemplate.fromTemplate(`
You are an expert research analyst. Answer the question using ONLY the provided context.
Cite sources inline using [Paper: <title>, Page: <page>] notation.
If context is insufficient, say so — never hallucinate.

Context:
{context}

Question: {question}

Give a detailed, structured answer with inline citations.`);

function buildContext(chunks) {
    return chunks
        .map((c, i) => {
            const { paper_title, page } = c.metadata;
            return `[${i + 1}] ${paper_title} | Page ${page}\n${c.content}`;
        })
        .join("\n\n---\n\n");
}

function computeConfidence(chunks) {
    if (!chunks.length) return 0;
    const scores = chunks.map((c) => c.rerankScore ?? c.distanceScore ?? 0);
    return Math.min(scores.reduce((a, b) => a + b, 0) / scores.length, 1);
}

export async function runRAGPipeline({
    question,
    paperIds = null,
    topK = TOP_K,
    useMMR = true,
    useQueryExpansion = true,
    useReranking = true,
}) {
    const start = Date.now();

    let queries = [question];
    let expandedQueries = null;
    if (useQueryExpansion) {
        queries = await expandQuery(question);
        expandedQueries = queries.slice(1);
    }

    let chunks = await retrieveChunks(question, queries, paperIds, topK, useMMR);

    if (useReranking && chunks.length > RERANK_TOP_K) {
        chunks = await llmRerank(question, chunks, RERANK_TOP_K);
    } else {
        chunks = chunks.slice(0, RERANK_TOP_K);
    }

    const context = buildContext(chunks);
    const llm = getLLM({ temperature: 0 });
    const chain = ANSWER_PROMPT.pipe(llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ context, question });

    return {
        question,
        answer,
        sources: chunks.map((c) => ({
            paperId: c.metadata.paper_id,
            paperTitle: c.metadata.paper_title,
            filename: c.metadata.filename,
            page: c.metadata.page,
            chunkIndex: c.metadata.chunk_index,
            content: c.content,
            relevanceScore: parseFloat((c.rerankScore ?? c.distanceScore ?? 0).toFixed(3)),
        })),
        expandedQueries,
        confidence: parseFloat(computeConfidence(chunks).toFixed(3)),
        processingTimeMs: Date.now() - start,
    };
}