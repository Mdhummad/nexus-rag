import { useState, useRef, useEffect, useCallback, useId } from "react";
import { usePapers } from "./hooks/usePapers.js";
import { api } from "./utils/api.js";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

// ── Tiny unique ID helper for messages ───────────────────────────────────────
let _msgId = 0;
const newId = () => `msg_${++_msgId}`;

function Ic({ d, size = 16, stroke = 1.8 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
            {d}
        </svg>
    );
}
const Icons = {
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
    send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
    chevron: <polyline points="6 9 12 15 18 9" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    clear: <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.13" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
};

function Spinner({ size = 16 }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            border: "2px solid rgba(245,158,11,0.2)",
            borderTopColor: "#f59e0b",
            animation: "spin 0.7s linear infinite", flexShrink: 0,
        }} />
    );
}

// ── Toast notification system (replaces alert()) ──────────────────────────────
function Toast({ toasts, remove }) {
    if (!toasts.length) return null;
    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
            {toasts.map((t) => (
                <div key={t.id} style={{
                    background: t.type === "error" ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.12)",
                    border: `1px solid ${t.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.4)"}`,
                    borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center",
                    gap: 10, fontSize: 12, color: t.type === "error" ? "#f87171" : "#34d399",
                    maxWidth: 320, animation: "fadeUp 0.3s ease", backdropFilter: "blur(8px)",
                }}>
                    <span style={{ flex: 1 }}>{t.message}</span>
                    <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 2, opacity: 0.6 }}>
                        <Ic d={Icons.x} size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function useToasts() {
    const [toasts, setToasts] = useState([]);
    const add = useCallback((message, type = "error") => {
        const id = newId();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    }, []);
    const remove = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
    return { toasts, add, remove };
}

// ── Connection status hook ─────────────────────────────────────────────────
function useConnectionStatus() {
    const [status, setStatus] = useState("connecting");
    const check = useCallback(async () => {
        try { await api.health(); setStatus("connected"); }
        catch { setStatus("disconnected"); }
    }, []);
    useEffect(() => {
        check();
        const interval = setInterval(check, 30_000);
        return () => clearInterval(interval);
    }, [check]);
    return status;
}

function ConnectionDot({ status }) {
    const colors = { connected: "#34d399", disconnected: "#f87171", connecting: "#f59e0b" };
    const labels = { connected: "Connected", disconnected: "Offline", connecting: "Connecting…" };
    const color = colors[status];
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color, fontFamily: "monospace" }}>
            <div style={{
                width: 7, height: 7, borderRadius: "50%", background: color,
                boxShadow: status === "connected" ? `0 0 6px ${color}` : "none",
                animation: status === "connecting" ? "pulse 1.5s infinite" : "none",
            }} />
            {labels[status]}
        </div>
    );
}

function ConfBar({ value }) {
    const [w, setW] = useState(0);
    const pct = Math.round(value * 100);
    const color = pct >= 70 ? "#34d399" : pct >= 40 ? "#f59e0b" : "#f87171";
    useEffect(() => { const t = setTimeout(() => setW(pct), 100); return () => clearTimeout(t); }, [pct]);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.34,1.56,.64,1)" }} />
            </div>
            <code style={{ fontSize: 11, color, minWidth: 32 }}>{pct}%</code>
        </div>
    );
}

function SourceCard({ src, idx }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, marginBottom: 6, overflow: "hidden", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.45)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.15)"}>
            <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "rgba(245,158,11,0.04)", border: "none", cursor: "pointer", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                <code style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: 4, padding: "1px 6px", fontSize: 10, flexShrink: 0 }}>[{idx}]</code>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.paperTitle}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>pg. {src.page ?? "?"} · {(src.relevanceScore * 100).toFixed(0)}% relevance</div>
                </div>
                <div style={{ color: "#475569", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                    <Ic d={Icons.chevron} size={12} />
                </div>
            </button>
            {open && (
                <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(245,158,11,0.1)", fontSize: 12, color: "#94a3b8", lineHeight: 1.7, fontStyle: "italic" }}>
                    "{src.content}"
                </div>
            )}
        </div>
    );
}

function PaperItem({ paper, selected, onToggle, onRemove, onAnalyze, onToast }) {
    const [analysisType, setAnalysisType] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const types = ["summary", "methodology", "contributions", "limitations", "future_work"];

    async function handleAnalyze(type) {
        setAnalysisType(type);
        setAnalysisResult(null);
        setAnalyzing(true);
        try {
            const r = await onAnalyze(paper.id, type);
            setAnalysisResult(r.content);
        } catch (e) {
            onToast("Analysis failed: " + e.message, "error");
        } finally {
            setAnalyzing(false);
        }
    }

    return (
        <div style={{ border: `1px solid ${selected ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden", background: selected ? "rgba(245,158,11,0.05)" : "transparent", transition: "all 0.2s" }}>
            <div style={{ padding: "11px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }} onClick={() => onToggle(paper.id)}>
                <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${selected ? "#f59e0b" : "rgba(255,255,255,0.2)"}`, background: selected ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {selected && <svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1 3.5 3.5 6 8 1" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {paper.title || paper.filename}
                    </div>
                    {paper.authors?.length > 0 && (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {paper.authors.slice(0, 2).join(", ")}{paper.authors.length > 2 ? ` +${paper.authors.length - 2}` : ""}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                        {[paper.year, `${paper.totalPages ?? "?"}pp`, `${paper.totalChunks} chunks`].filter(Boolean).map(t => (
                            <span key={t} style={{ background: "rgba(255,255,255,0.06)", color: "#64748b", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontFamily: "monospace" }}>{t}</span>
                        ))}
                        <span style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontFamily: "monospace" }}>● ready</span>
                    </div>
                </div>
                <button onClick={e => { e.stopPropagation(); onRemove(paper.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4, borderRadius: 4, transition: "color 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                    onMouseLeave={e => e.currentTarget.style.color = "#334155"}>
                    <Ic d={Icons.trash} size={13} />
                </button>
            </div>
            {selected && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", marginBottom: 7, letterSpacing: "0.08em" }}>DEEP ANALYSIS</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {types.map(t => (
                            <button key={t} onClick={() => handleAnalyze(t)} disabled={analyzing}
                                style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: analyzing ? "not-allowed" : "pointer", fontFamily: "monospace", transition: "all 0.15s", background: analysisType === t && !analyzing ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${analysisType === t ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, color: analysisType === t ? "#f59e0b" : "#64748b" }}>
                                {t.replace("_", " ")}
                            </button>
                        ))}
                    </div>
                    {analyzing && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "#f59e0b" }}>
                            <Spinner size={12} /> Analyzing…
                        </div>
                    )}
                    {analysisResult && !analyzing && (
                        <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", lineHeight: 1.75, background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 10, maxHeight: 180, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                            {analysisResult}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── rehypeSanitize config — allow safe markdown, block script/iframe/etc. ────
const SANITIZE_SCHEMA = {
    tagNames: ["p", "strong", "em", "code", "pre", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "hr", "br", "a", "table", "thead", "tbody", "tr", "th", "td"],
    attributes: { a: ["href", "title"], "*": ["className"] },
};

function Message({ msg }) {
    const isUser = msg.role === "user";
    return (
        <div style={{ marginBottom: 28, animation: "fadeUp 0.3s ease" }}>
            <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginBottom: 5, display: "flex", alignItems: "center", gap: 5, justifyContent: isUser ? "flex-end" : "flex-start" }}>
                {isUser ? <><Ic d={Icons.send} size={10} /> YOU</> : <><Ic d={Icons.zap} size={10} /> NEXUS RAG</>}
            </div>
            <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", background: isUser ? "#f59e0b" : "rgba(255,255,255,0.04)", border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px", padding: "12px 16px", fontSize: 13, lineHeight: 1.8, color: isUser ? "#000" : "#cbd5e1", fontWeight: isUser ? 600 : 400 }}>
                    {isUser ? msg.content : (
                        <div className="prose" style={{ fontSize: 13, lineHeight: 1.8 }}>
                            {/* rehypeSanitize prevents XSS from LLM-generated HTML */}
                            <ReactMarkdown rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
            {!isUser && msg.data && (
                <div style={{ maxWidth: "80%", marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        {[
                            `⏱ ${msg.data.processingTimeMs}ms`,
                            `📎 ${msg.data.sources?.length} sources`,
                            msg.data.expandedQueries?.length && `🔀 ${msg.data.expandedQueries.length} expansions`,
                            msg.data.timings?.retrieval && `🔍 ${msg.data.timings.retrieval}ms retrieval`,
                        ].filter(Boolean).map(l => (
                            <span key={l} style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, padding: "3px 8px" }}>{l}</span>
                        ))}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", marginBottom: 4, letterSpacing: "0.08em" }}>CONFIDENCE</div>
                        <ConfBar value={msg.data.confidence} />
                    </div>
                    {msg.data.expandedQueries?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", marginBottom: 5, letterSpacing: "0.08em" }}>EXPANDED QUERIES</div>
                            {msg.data.expandedQueries.map((q, i) => (
                                <div key={i} style={{ fontSize: 11, color: "#f59e0b", padding: "3px 10px", background: "rgba(245,158,11,0.06)", borderLeft: "2px solid #f59e0b", borderRadius: "0 4px 4px 0", marginBottom: 3 }}>{q}</div>
                            ))}
                        </div>
                    )}
                    {msg.data.sources?.length > 0 && (
                        <div>
                            <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", marginBottom: 5, letterSpacing: "0.08em" }}>RETRIEVED SOURCES</div>
                            {msg.data.sources.map((s, i) => <SourceCard key={s.chunkIndex ?? i} src={s} idx={i + 1} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const INITIAL_MESSAGE = {
    id: "msg_0",
    role: "assistant",
    content: "Upload research papers on the left, then ask me anything. I'll retrieve the most relevant sections and generate a cited, confidence-scored answer.",
};
const MAX_QUESTION_LENGTH = 2000;

export default function App() {
    const { papers, uploading, uploadingFile, upload, remove, error: uploadError } = usePapers();
    const { toasts, add: addToast, remove: removeToast } = useToasts();
    const [selected, setSelected] = useState(new Set());
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [input, setInput] = useState("");
    const [querying, setQuerying] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [cfg, setCfg] = useState({ useMMR: true, useQueryExpansion: true, useReranking: true, topK: 5 });
    const [drag, setDrag] = useState(false);
    const chatRef = useRef();
    const inputRef = useRef();
    const abortRef = useRef(null);    // ← abort controller for in-flight queries
    const connectionStatus = useConnectionStatus();

    // Surface upload errors as toasts
    useEffect(() => {
        if (uploadError) addToast(uploadError, "error");
    }, [uploadError, addToast]);

    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, querying]);

    // Cleanup abort controller on unmount
    useEffect(() => () => abortRef.current?.abort(), []);

    function togglePaper(id) {
        setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }

    async function handleUpload(files) {
        for (const f of files) {
            if (f.name.endsWith(".pdf")) {
                try { await upload(f); }
                catch (e) { addToast("Upload failed: " + e.message, "error"); }
            } else {
                addToast(`"${f.name}" is not a PDF — only PDF files are supported.`, "error");
            }
        }
    }

    async function handleQuery() {
        const q = input.trim();
        if (!q || querying) return;
        if (q.length > MAX_QUESTION_LENGTH) {
            addToast(`Question too long (${q.length}/${MAX_QUESTION_LENGTH} chars)`, "error");
            return;
        }

        // Cancel any previous in-flight request
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setInput("");
        setMessages(prev => [...prev, { id: newId(), role: "user", content: q }]);
        setQuerying(true);
        try {
            const data = await api.query({
                question: q,
                paperIds: selected.size > 0 ? [...selected] : null,
                topK: cfg.topK,
                useMMR: cfg.useMMR,
                useQueryExpansion: cfg.useQueryExpansion,
                useReranking: cfg.useReranking,
            }, abortRef.current.signal);
            setMessages(prev => [...prev, { id: newId(), role: "assistant", content: data.answer, data }]);
        } catch (e) {
            if (e.name === "AbortError") return;   // request was intentionally cancelled
            setMessages(prev => [...prev, { id: newId(), role: "assistant", content: `**Error:** ${e.message}` }]);
        } finally {
            setQuerying(false);
        }
    }

    function clearChat() {
        abortRef.current?.abort();
        setQuerying(false);
        setMessages([INITIAL_MESSAGE]);
    }

    const suggestions = ["What is the main contribution?", "Explain the methodology", "What datasets were used?", "What are the key limitations?"];
    const charsLeft = MAX_QUESTION_LENGTH - input.length;

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%}
        body{background:#0c0e14;color:#cbd5e1;font-family:'DM Sans',sans-serif;overflow:hidden}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(245,158,11,0.2);border-radius:99px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        textarea{resize:none;font-family:'DM Sans',sans-serif}
        textarea:focus{outline:none}
        button{font-family:'DM Sans',sans-serif}
        code{font-family:'DM Mono',monospace}
        .prose p{margin-bottom:0.75em}
        .prose p:last-child{margin-bottom:0}
        .prose strong{color:#f1f5f9;font-weight:600}
        .prose code{background:rgba(245,158,11,0.1);color:#f59e0b;padding:1px 5px;border-radius:3px;font-size:12px}
        .prose a{color:#f59e0b;text-decoration:underline}
        .prose ul,.prose ol{padding-left:1.25em;margin-bottom:0.75em}
        .prose blockquote{border-left:3px solid rgba(245,158,11,0.4);padding-left:10px;color:#94a3b8;margin:0.5em 0}
      `}</style>

            <Toast toasts={toasts} remove={removeToast} />

            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(245,158,11,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.02) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
            <div style={{ position: "fixed", top: -150, right: "15%", width: 500, height: 500, background: "radial-gradient(circle,rgba(245,158,11,0.06) 0%,transparent 65%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, display: "flex", height: "100vh", overflow: "hidden" }}>

                {/* ── Sidebar ─────────────────────────────────────────────────── */}
                <aside style={{ width: 295, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
                    <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: "#f1f5f9", letterSpacing: "-0.5px" }}>
                            Nexus <span style={{ color: "#f59e0b" }}>RAG</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>
                            Node.js · Express · Groq · ChromaDB
                        </div>
                    </div>

                    <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div
                            onDragOver={e => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={e => { e.preventDefault(); setDrag(false); handleUpload([...e.dataTransfer.files]); }}
                            onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = ".pdf"; i.multiple = true; i.onchange = e => handleUpload([...e.target.files]); i.click(); }}
                            style={{ border: `2px dashed ${drag ? "#f59e0b" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "16px 10px", textAlign: "center", cursor: "pointer", background: drag ? "rgba(245,158,11,0.05)" : "transparent", transition: "all 0.2s" }}>
                            {uploading ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: 12 }}>
                                    <Spinner size={14} />
                                    <span>Processing…</span>
                                    {uploadingFile && (
                                        <span style={{ fontSize: 10, color: "#94a3b8", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 8px" }}>
                                            {uploadingFile}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div style={{ color: "#475569", display: "flex", justifyContent: "center", marginBottom: 5 }}>
                                        <Ic d={Icons.upload} size={18} />
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>Drop PDFs or click to upload</div>
                                </>
                            )}
                        </div>
                        {selected.size > 0 && (
                            <div style={{ marginTop: 8, fontSize: 10, color: "#f59e0b", fontFamily: "monospace", textAlign: "center" }}>
                                {selected.size} paper{selected.size !== 1 ? "s" : ""} in scope
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                        <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                            <span>PAPERS</span><span style={{ color: "#f59e0b" }}>{papers.length}</span>
                        </div>
                        {papers.length === 0 && (
                            <div style={{ fontSize: 12, color: "#334155", textAlign: "center", paddingTop: 24 }}>
                                No papers yet.<br />Upload a PDF to begin.
                            </div>
                        )}
                        {papers.map(p => (
                            <PaperItem key={p.id} paper={p} selected={selected.has(p.id)} onToggle={togglePaper} onRemove={remove} onAnalyze={api.analyzePaper} onToast={addToast} />
                        ))}
                    </div>
                </aside>

                {/* ── Main ────────────────────────────────────────────────────── */}
                <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <header style={{ padding: "13px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)" }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>Research Query Engine</div>
                            <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginTop: 1 }}>
                                {selected.size > 0 ? `Scoped to ${selected.size}/${papers.length} papers` : `All ${papers.length} papers`}
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <ConnectionDot status={connectionStatus} />
                            {messages.length > 1 && (
                                <button id="clear-chat-btn" onClick={clearChat} title="Clear conversation"
                                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, cursor: "pointer", color: "#475569", fontSize: 10, fontFamily: "monospace", transition: "all 0.2s" }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                                    <Ic d={Icons.clear} size={11} /> CLEAR
                                </button>
                            )}
                            <button id="pipeline-config-btn" onClick={() => setSettingsOpen(!settingsOpen)}
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: settingsOpen ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${settingsOpen ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 7, cursor: "pointer", color: "#94a3b8", fontSize: 11, fontFamily: "monospace", transition: "all 0.2s" }}>
                                <Ic d={Icons.settings} size={12} /> Pipeline Config
                            </button>
                        </div>
                    </header>

                    {settingsOpen && (
                        <div style={{ padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", animation: "fadeUp 0.2s ease" }}>
                            {[["useMMR", "MMR Diversity"], ["useQueryExpansion", "Query Expansion"], ["useReranking", "LLM Re-ranking"]].map(([k, l]) => (
                                <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11, color: "#94a3b8" }}>
                                    <div onClick={() => setCfg(c => ({ ...c, [k]: !c[k] }))} style={{ width: 32, height: 18, borderRadius: 9, background: cfg[k] ? "#f59e0b" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                                        <div style={{ position: "absolute", top: 2, left: cfg[k] ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: cfg[k] ? "#000" : "#fff", transition: "left 0.2s" }} />
                                    </div>
                                    {l}
                                </label>
                            ))}
                            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#94a3b8" }}>
                                Top-K:
                                <input type="range" min={1} max={15} value={cfg.topK} onChange={e => setCfg(c => ({ ...c, topK: +e.target.value }))} style={{ width: 70, accentColor: "#f59e0b" }} />
                                <code style={{ color: "#f59e0b", minWidth: 16, fontSize: 11 }}>{cfg.topK}</code>
                            </label>
                        </div>
                    )}

                    <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                        {/* Messages are keyed by stable ID, not array index */}
                        {messages.map((m) => <Message key={m.id} msg={m} />)}
                        {querying && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f59e0b", fontSize: 11, fontFamily: "monospace", animation: "fadeUp 0.3s ease", marginBottom: 16 }}>
                                <Spinner size={14} />
                                <span style={{ animation: "pulse 1.5s infinite" }}>expand → retrieve → rerank → generate…</span>
                            </div>
                        )}
                        {messages.length === 1 && !querying && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 8 }}>TRY ASKING</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                    {suggestions.map(s => (
                                        <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "#64748b", fontSize: 12, transition: "all 0.2s" }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.background = "rgba(245,158,11,0.05)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 14px", transition: "border-color 0.2s" }}
                                onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.45)"}
                                onBlurCapture={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
                                <textarea
                                    id="query-input"
                                    ref={inputRef} value={input}
                                    onChange={e => setInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuery(); } }}
                                    placeholder="Ask about methodology, findings, comparisons… (Enter to send)"
                                    rows={1} style={{ width: "100%", background: "none", border: "none", color: "#e2e8f0", fontSize: 13, lineHeight: 1.5 }} />
                            </div>
                            <button id="send-query-btn" onClick={handleQuery} disabled={!input.trim() || querying}
                                style={{ width: 42, height: 42, borderRadius: 10, border: "none", cursor: "pointer", background: !input.trim() || querying ? "rgba(245,158,11,0.2)" : "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", color: "#000" }}
                                onMouseDown={e => { if (!querying && input.trim()) e.currentTarget.style.transform = "scale(0.92)"; }}
                                onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
                                {querying ? <Spinner size={15} /> : <Ic d={Icons.send} size={15} />}
                            </button>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 9, color: "#1e293b", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                                MULTI-QUERY EXPANSION · MMR · LLM RE-RANKING · CITATION-AWARE GENERATION
                            </div>
                            {/* Character counter — turns red when near limit */}
                            {input.length > MAX_QUESTION_LENGTH * 0.8 && (
                                <div style={{ fontSize: 9, fontFamily: "monospace", color: charsLeft < 100 ? "#f87171" : "#475569" }}>
                                    {charsLeft} left
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
