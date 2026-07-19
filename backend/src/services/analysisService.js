import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getLLM, getEmbeddings } from "./llmService.js";
import { searchVectors } from "./qdrantService.js";

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

// Representative queries per analysis type to retrieve the most relevant chunks
const ANALYSIS_QUERIES = {
    summary:       "overview summary introduction abstract conclusion findings",
    methodology:   "methodology experimental design datasets metrics evaluation baseline",
    contributions: "contributions novelty proposed approach key results improvements",
    limitations:   "limitations drawbacks weaknesses future work discussion",
    future_work:   "future work open problems directions limitations discussion",
};

export async function analyzePaper(paperId, analysisType) {
    if (!ANALYSIS_PROMPTS[analysisType]) {
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }

    // Use a representative query to pull the most relevant chunks for this analysis type
    const embedder    = getEmbeddings();
    const queryText   = ANALYSIS_QUERIES[analysisType];
    const queryVector = await embedder.embedQuery(queryText);

    // Retrieve up to 20 chunks from this specific paper
    const results = await searchVectors(queryVector, {
        nResults: 20,
        paperIds: [paperId],
    });

    if (!results.length) {
        throw new Error(`No content found for paper: ${paperId}`);
    }

    // Sort by page then chunk index for coherent reading order
    const sorted = [...results].sort((a, b) =>
        (a.metadata.page - b.metadata.page) ||
        (a.metadata.chunk_index - b.metadata.chunk_index)
    );

    // Sample beginning, middle, end for broad coverage
    const total   = sorted.length;
    const indices = new Set([
        ...Array.from({ length: Math.ceil(total * 0.35) }, (_, i) => i),
        ...Array.from({ length: Math.ceil(total * 0.3)  }, (_, i) => Math.floor(total * 0.35) + i),
        ...Array.from({ length: Math.ceil(total * 0.35) }, (_, i) => total - Math.ceil(total * 0.35) + i),
    ]);

    const selected = [...indices]
        .filter(i => i < total)
        .sort((a, b) => a - b)
        .map(i => sorted[i]);

    const context = selected
        .map(({ content, metadata }) => `[Page ${metadata.page}]\n${content}`)
        .join("\n\n---\n\n")
        .slice(0, 5000);

    const start   = Date.now();
    const llm     = getLLM({ temperature: 0.2, maxTokens: 1500 });
    const prompt  = ChatPromptTemplate.fromTemplate(ANALYSIS_PROMPTS[analysisType]);
    const chain   = prompt.pipe(llm).pipe(new StringOutputParser());
    const content = await chain.invoke({ context });

    return {
        paperId,
        analysisType,
        content,
        processingTimeMs: Date.now() - start,
    };
}