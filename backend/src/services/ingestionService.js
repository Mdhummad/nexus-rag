import pdfParse from "pdf-parse";
import { v4 as uuid } from "uuid";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getLLM, getEmbeddings } from "./llmService.js";
import { getCollection } from "./chromaService.js";

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP) || 200;

const METADATA_PROMPT = ChatPromptTemplate.fromTemplate(`
Extract metadata from this research paper text.
Return ONLY valid JSON with these keys (use null if not found):
- title: string or null
- authors: array of strings or null
- abstract: string (max 400 chars) or null
- year: number or null

Text:
{text}

JSON only, no explanation, no markdown:`);

async function extractMetadata(text) {
    try {
        const llm = getLLM({ temperature: 0 });
        const chain = METADATA_PROMPT.pipe(llm).pipe(new StringOutputParser());
        const raw = await chain.invoke({ text: text.slice(0, 2000) });
        const cleaned = raw.replace(/```(?:json)?|```/g, "").trim();
        return JSON.parse(cleaned);
    } catch {
        return {};
    }
}

async function chunkText(pages, paperId, paperTitle, filename) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        separators: ["\n\n", "\n", ". ", " ", ""],
    });

    const chunks = [];
    let chunkIndex = 0;

    for (const { pageNum, text } of pages) {
        const pageChunks = await splitter.splitText(text);
        for (const content of pageChunks) {
            if (content.trim().length < 50) continue;
            const chunkId = `${paperId}_chunk_${chunkIndex}`;
            chunks.push({
                id: chunkId,
                content: content.trim(),
                metadata: {
                    chunk_id: chunkId,
                    paper_id: paperId,
                    paper_title: paperTitle,
                    filename,
                    page: pageNum,
                    chunk_index: chunkIndex,
                },
            });
            chunkIndex++;
        }
    }
    return chunks;
}

async function embedAndStore(chunks) {
    if (!chunks.length) return 0;

    const embedder = getEmbeddings();
    const collection = getCollection();
    const BATCH = 100;
    let stored = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const texts = batch.map((c) => c.content);
        const embeddings = await embedder.embedDocuments(texts);

        await collection.upsert({
            ids: batch.map((c) => c.id),
            documents: texts,
            embeddings,
            metadatas: batch.map((c) => c.metadata),
        });
        stored += batch.length;
        process.stdout.write(`\r      Embedded ${stored}/${chunks.length} chunks...`);
    }
    process.stdout.write("\n");
    return stored;
}

export async function ingestPaper(fileBuffer, filename) {
    const paperId = uuid();

    console.log(`\n  Parsing ${filename}...`);
    const parsed = await pdfParse(fileBuffer);
    const fullText = parsed.text;
    const totalPages = parsed.numpages;

    const pages = [{ pageNum: 1, text: fullText }];

    console.log("  Extracting metadata...");
    const meta = await extractMetadata(fullText);
    const paperTitle = meta.title || filename.replace(/\.pdf$/i, "");

    console.log("  Chunking text...");
    const chunks = await chunkText(pages, paperId, paperTitle, filename);
    console.log(`  Created ${chunks.length} chunks`);

    console.log("  Embedding chunks...");
    const totalChunks = await embedAndStore(chunks);
    console.log(`  Stored ${totalChunks} chunks in ChromaDB ✓`);

    return {
        id: paperId,
        filename,
        title: paperTitle,
        authors: meta.authors || null,
        abstract: meta.abstract || null,
        year: meta.year || null,
        totalPages,
        totalChunks,
        status: "ready",
        uploadedAt: new Date().toISOString(),
    };
}