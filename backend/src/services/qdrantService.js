import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "crypto";

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "research_papers";
const QDRANT_URL      = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY  = process.env.QDRANT_API_KEY || null;
const VECTOR_SIZE     = 384; // all-MiniLM-L6-v2 output dimension

let _client = null;
let _ready  = false;

// Convert any string ID to a deterministic UUID (Qdrant requires UUID or integer)
function toUUID(str) {
    const hash = crypto.createHash("md5").update(str).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function initQdrant() {
    console.log(`[Qdrant] Connecting to ${QDRANT_URL}...`);
    _client = new QdrantClient({
        url:    QDRANT_URL,
        apiKey: QDRANT_API_KEY,
    });

    // Verify connection
    try {
        await _client.getCollections();
        console.log("[Qdrant] Connection verified ✓");
    } catch (err) {
        throw new Error(`Qdrant unreachable: ${err.message}`);
    }

    // Create collection if it doesn't exist
    try {
        await _client.getCollection(COLLECTION_NAME);
        console.log(`[Qdrant] Collection "${COLLECTION_NAME}" exists ✓`);
    } catch {
        console.log(`[Qdrant] Creating collection "${COLLECTION_NAME}"...`);
        await _client.createCollection(COLLECTION_NAME, {
            vectors: {
                size:     VECTOR_SIZE,
                distance: "Cosine",
            },
        });
        // Create payload indexes for fast filtering
        await _client.createPayloadIndex(COLLECTION_NAME, {
            field_name: "paper_id",
            field_schema: "keyword",
        });
        console.log(`[Qdrant] Collection created ✓`);
    }
    _ready = true;
    return true;
}

function getClient() {
    if (!_client || !_ready) throw new Error("Qdrant not initialized — call initQdrant() first");
    return _client;
}

// ── Upsert chunks ─────────────────────────────────────────────────────────────
// items: Array<{ id: string, embedding: number[], document: string, metadata: object }>
export async function upsertChunks(items) {
    const client = getClient();
    const points = items.map((item) => ({
        id:      toUUID(item.id),
        vector:  item.embedding,
        payload: {
            ...item.metadata,
            text:        item.document,
            original_id: item.id,
        },
    }));
    await client.upsert(COLLECTION_NAME, { points, wait: true });
}

// ── Search vectors ────────────────────────────────────────────────────────────
// Returns results in the same shape ragService expects:
// [{ chunkId, content, metadata, distanceScore, embedding }]
export async function searchVectors(queryEmbedding, { nResults = 10, paperIds = null } = {}) {
    const client = getClient();

    const filter = paperIds?.length
        ? { must: [{ key: "paper_id", match: { any: paperIds } }] }
        : undefined;

    const results = await client.search(COLLECTION_NAME, {
        vector:       queryEmbedding,
        limit:        nResults,
        filter,
        with_payload: true,
        with_vector:  true,
    });

    return results.map((r) => ({
        chunkId:       r.payload.original_id || String(r.id),
        content:       r.payload.text,
        metadata:      r.payload,
        distanceScore: r.score,          // Qdrant cosine: higher = more similar (0–1)
        embedding:     r.vector ?? [],
    }));
}

// ── Delete by paper ID ────────────────────────────────────────────────────────
export async function deleteByPaperId(paperId) {
    const client = getClient();
    const result = await client.delete(COLLECTION_NAME, {
        filter: { must: [{ key: "paper_id", match: { value: paperId } }] },
        wait: true,
    });
    return result?.status === "completed" ? 1 : 0;
}

// ── Count total chunks ────────────────────────────────────────────────────────
export async function getChunkCount() {
    try {
        const info = await getClient().getCollection(COLLECTION_NAME);
        return info.points_count ?? 0;
    } catch {
        return 0;
    }
}
