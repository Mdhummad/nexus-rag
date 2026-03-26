import { ChromaClient } from "chromadb";

const COLLECTION_NAME = process.env.CHROMA_COLLECTION || "research_papers";
const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8001";

let client = null;
let collection = null;

export async function initChroma() {
    client = new ChromaClient({
        path: CHROMA_URL,
        auth: {
            provider: "token",
            credentials: process.env.CHROMA_API_KEY,
            tokenHeaderType: "X_CHROMA_TOKEN",
        },
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
    });
    collection = await client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { "hnsw:space": "cosine" },
    });
    return collection;
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
