import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getLLM } from "./llmService.js";
import { getCollection } from "./chromaService.js";

const ANALYSIS_PROMPTS = {
    summary: `You are an expert research analyst.
Write a comprehensive 3-5 paragraph summary of this paper.
Cover: problem, approach, key findings, and significance.
Excerpts:
{context}
Summary:`,

    methodology: `You are an expert in research methodology.
Analyze the methodology: experimental design, datasets, metrics, baselines, statistical rigor.
Excerpts:
{context}
Methodology Analysis:`,

    contributions: `You are an expert research evaluator.
List and evaluate the key contributions with their novelty and significance.
Excerpts:
{context}
Key Contributions:`,

    limitations: `You are a critical research reviewer.
Identify limitations: methodological, scope, generalizability, and reproducibility concerns.
Excerpts:
{context}
Limitations:`,

    future_work: `You are a research strategist.
Suggest concrete, specific future research directions based on this paper's findings.
Excerpts:
{context}
Future Research Directions:`,
};

export async function analyzePaper(paperId, analysisType) {
    if (!ANALYSIS_PROMPTS[analysisType]) {
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }

    const collection = getCollection();
    const results = await collection.get({
        where: { paper_id: paperId },
        include: ["documents", "metadatas"],
    });

    if (!results.ids.length) {
        throw new Error(`No content found for paper: ${paperId}`);
    }

    const combined = results.ids.map((_, i) => ({
        doc: results.documents[i],
        meta: results.metadatas[i],
    })).sort((a, b) =>
        (a.meta.page - b.meta.page) || (a.meta.chunk_index - b.meta.chunk_index)
    );

    const total = combined.length;
    const indices = new Set([
        ...Array.from({ length: Math.ceil(total * 0.2) }, (_, i) => i),
        ...Array.from({ length: Math.ceil(total * 0.2) }, (_, i) => Math.floor(total * 0.4) + i),
        ...Array.from({ length: Math.ceil(total * 0.2) }, (_, i) => total - Math.ceil(total * 0.2) + i),
    ]);

    const selected = [...indices]
        .filter((i) => i < total)
        .sort((a, b) => a - b)
        .map((i) => combined[i]);

    const context = selected
        .map(({ doc, meta }) => `[Page ${meta.page}]\n${doc}`)
        .join("\n\n---\n\n")
        .slice(0, 5000);

    const start = Date.now();
    const llm = getLLM({ temperature: 0.2, maxTokens: 1500 });
    const prompt = ChatPromptTemplate.fromTemplate(ANALYSIS_PROMPTS[analysisType]);
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    const content = await chain.invoke({ context });

    return {
        paperId,
        analysisType,
        content,
        processingTimeMs: Date.now() - start,
    };
}