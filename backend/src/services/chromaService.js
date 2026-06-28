import { ChromaClient } from "chromadb";

const COLLECTION_NAME = process.env.CHROMA_COLLECTION || "research_papers";
const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8001";
const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 5000;

let client = null;
let collection = null;

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initChroma() {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[ChromaDB] Connecting to ${CHROMA_URL} (attempt ${attempt}/${MAX_RETRIES})...`);
            client = new ChromaClient({ path: CHROMA_URL });
            // Heartbeat to verify connection
            await client.heartbeat();
            collection = await client.getOrCreateCollection({
                name: COLLECTION_NAME,
                metadata: { "hnsw:space": "cosine" },
            });
            console.log(`[ChromaDB] Connected ✓ — collection: "${COLLECTION_NAME}"`);
            return collection;
        } catch (err) {
            lastError = err;
            console.warn(`[ChromaDB] Attempt ${attempt} failed: ${err.message}`);
            if (attempt < MAX_RETRIES) {
                console.log(`[ChromaDB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await sleep(RETRY_DELAY_MS);
            }
        }
    }
    throw new Error(`ChromaDB unreachable after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

export function getCollection() {
    if (!collection) throw new Error("ChromaDB not initialized");
    return collection;
}

export async function getChunkCount() {
    return collection ? await collection.count() : 0;
}

export async function deleteByPaperId(paperId) {
    const col = getCollection();
    const results = await col.get({ where: { paper_id: paperId } });
    if (results.ids.length > 0) {
        await col.delete({ ids: results.ids });
    }
    return results.ids.length;
}