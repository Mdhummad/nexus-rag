import { useState, useRef, useEffect, useCallback } from "react";
import { usePapers } from "./hooks/usePapers.js";
import { api, queryStream } from "./utils/api.js";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

/* ─── ID generator ──────────────────────────────────────────────────────────── */
let _id = 0;
const newId = () => `m${++_id}`;

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const T = {
  bg:          "#0d0f17",
  sidebar:     "#0f1119",
  surface:     "#13161f",
  surfaceHigh: "#181c27",
  accent:      "#6366f1",
  accentSoft:  "rgba(99,102,241,0.14)",
  accentBorder:"rgba(99,102,241,0.35)",
  border:      "rgba(255,255,255,0.07)",
  borderMid:   "rgba(255,255,255,0.11)",
  t1:          "rgba(255,255,255,0.92)",
  t2:          "rgba(255,255,255,0.55)",
  t3:          "rgba(255,255,255,0.28)",
  red:         "#f87171",
  green:       "#4ade80",
  yellow:      "#facc15",
};

/* ─── Tiny SVG icon ─────────────────────────────────────────────────────────── */
function Ic({ d, size = 16, sw = 1.8, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const IC = {
  upload:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  trash:   <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
  send:    <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
  brain:   <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.16Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.16Z"/></>,
  x:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  check:   <polyline points="20 6 9 17 4 12"/>,
  copy:    <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  chevron: <polyline points="6 9 12 15 18 9"/>,
  sparkle: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></>,
  layers:  <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  clock:   <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  file:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  menu:    <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
  stop:    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" fill="currentColor"/>,
  panel:   <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></>,
  zap:     <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
};

/* ─── Spinner ───────────────────────────────────────────────────────────────── */
function Spinner({ size = 15, color = T.accent }) {
  return <div style={{
    width: size, height: size, borderRadius: "50%",
    border: `2px solid ${color}25`, borderTopColor: color,
    animation: "spin .7s linear infinite", flexShrink: 0,
  }} />;
}

/* ─── Toast system ──────────────────────────────────────────────────────────── */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "error") => {
    const id = newId();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);
  const rm = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, rm };
}

function Toasts({ toasts, rm }) {
  if (!toasts?.length) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.08)",
          border: `1px solid ${t.type === "error" ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`,
          borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center",
          gap: 10, fontSize: 13, color: t.type === "error" ? T.red : T.green,
          maxWidth: 320, backdropFilter: "blur(20px)", animation: "fadeUp .25s ease",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.msg}</span>
          <button onClick={() => rm(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.5, padding: 2 }}>
            <Ic d={IC.x} size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── Pipeline step bar ─────────────────────────────────────────────────────── */
const STEPS = ["Expanding query", "Retrieving", "Re-ranking", "Generating"];
function PipelineBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500,
            background: i < step ? T.accentSoft : i === step ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${i < step ? T.accentBorder : i === step ? "rgba(99,102,241,0.5)" : T.border}`,
            color: i < step ? "#a5b4fc" : i === step ? "#c7d2fe" : T.t3,
            transition: "all .3s",
          }}>
            {i < step ? <Ic d={IC.check} size={10} /> : i === step ? <Spinner size={10} color="#818cf8" /> : null}
            {s}
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ width: 10, height: 1, background: i < step ? T.accentBorder : T.border }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Copy button ───────────────────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); });
    }} style={{
      background: done ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${done ? "rgba(74,222,128,0.3)" : T.border}`,
      borderRadius: 7, padding: "4px 10px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 5,
      color: done ? T.green : T.t3, fontSize: 11, transition: "all .2s",
    }}>
      <Ic d={done ? IC.check : IC.copy} size={11} />
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* ─── Confidence badge ──────────────────────────────────────────────────────── */
function Confidence({ v }) {
  const pct = Math.round(v * 100);
  const col = pct >= 75 ? T.green : pct >= 50 ? T.yellow : T.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: T.t3, whiteSpace: "nowrap" }}>Confidence</span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3, transition: "width .6s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: col, minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

/* ─── Source card ───────────────────────────────────────────────────────────── */
function SourceCard({ src, idx }) {
  const [open, setOpen] = useState(false);
  const score = Math.round((src.relevanceScore ?? 0) * 100);
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, overflow: "hidden", transition: "border-color .15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.accentBorder}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
    >
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "none", border: "none", cursor: "pointer",
        padding: "9px 11px", display: "flex", alignItems: "center", gap: 9, textAlign: "left",
      }}>
        <div style={{
          minWidth: 20, height: 20, borderRadius: 5, background: T.accentSoft,
          border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#a5b4fc", flexShrink: 0,
        }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {src.paperTitle}
          </div>
          <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
            Page {src.page} · {score}% match
          </div>
        </div>
        <div style={{ color: T.t3, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>
          <Ic d={IC.chevron} size={13} />
        </div>
      </button>
      {open && (
        <div style={{
          padding: "0 11px 11px", fontSize: 12, color: T.t2, lineHeight: 1.6,
          borderTop: `1px solid ${T.border}`, paddingTop: 9,
        }}>
          {src.content?.slice(0, 400)}{src.content?.length > 400 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

/* ─── Sources panel (right column) ─────────────────────────────────────────── */
function SourcesPanel({ msg }) {
  if (!msg || (!msg.sources?.length && !msg.confidence)) return (
    <div style={{ flex: "0 0 0", overflow: "hidden", transition: "flex .3s ease" }} />
  );

  return (
    <div style={{
      flex: "0 0 300px", borderLeft: `1px solid ${T.border}`,
      background: T.sidebar, display: "flex", flexDirection: "column", overflow: "hidden",
      transition: "flex .3s ease",
    }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, display: "flex", alignItems: "center", gap: 7 }}>
          <Ic d={IC.file} size={14} />
          Sources
          {msg.sources?.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 400, color: T.t3 }}>
              · {msg.sources.length} found
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Confidence */}
        {msg.confidence != null && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
            <Confidence v={msg.confidence} />
          </div>
        )}

        {/* Timing badges */}
        {msg.timings && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {Object.entries(msg.timings).map(([k, v]) => (
              <div key={k} style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 20,
                background: T.accentSoft, border: `1px solid ${T.accentBorder}`,
                color: "#a5b4fc",
              }}>
                {k}: {v}ms
              </div>
            ))}
          </div>
        )}

        {/* Expanded queries */}
        {msg.expandedQueries?.length > 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 7 }}>
              Query Expansions
            </div>
            {msg.expandedQueries.map((q, i) => (
              <div key={i} style={{ fontSize: 11, color: T.t2, lineHeight: 1.5, marginBottom: i < msg.expandedQueries.length - 1 ? 5 : 0 }}>
                → {q}
              </div>
            ))}
          </div>
        )}

        {/* Source cards */}
        {msg.sources?.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: ".05em", textTransform: "uppercase" }}>
              Retrieved Chunks
            </div>
            {msg.sources.map((s, i) => <SourceCard key={i} src={s} idx={i} />)}
          </>
        )}

        {/* Processing time */}
        {msg.processingTimeMs && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.t3 }}>
            <Ic d={IC.clock} size={11} />
            Total: {(msg.processingTimeMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Message bubble ────────────────────────────────────────────────────────── */
function Bubble({ msg }) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{
          maxWidth: "72%", background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
          borderRadius: "16px 16px 4px 16px", padding: "11px 15px",
          fontSize: 14, color: "#fff", lineHeight: 1.65,
          boxShadow: "0 2px 16px rgba(99,102,241,0.25)",
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant") {
    return (
      <div style={{ display: "flex", gap: 11, marginBottom: 24, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: T.accentSoft, border: `1px solid ${T.accentBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8",
        }}>
          <Ic d={IC.brain} size={15} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Pipeline bar while streaming */}
          {msg.streaming && <PipelineBar step={msg.pipelineStep ?? 3} />}

          {/* Answer */}
          <div style={{ fontSize: 14, lineHeight: 1.75, color: T.t1 }} className="markdown-body">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
              {msg.content || (msg.streaming ? "▍" : "")}
            </ReactMarkdown>
          </div>

          {/* Action row after done */}
          {!msg.streaming && msg.content && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <CopyBtn text={msg.content} />
              {msg.expandedQueries?.length > 0 && (
                <span style={{ fontSize: 11, color: T.t3 }}>
                  +{msg.expandedQueries.length} query expansions
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "error") {
    return (
      <div style={{
        display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 16,
        padding: "11px 14px", background: "rgba(248,113,113,0.07)",
        border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10,
      }}>
        <Ic d={IC.x} size={15} />
        <span style={{ fontSize: 13, color: T.red, lineHeight: 1.5 }}>{msg.content}</span>
      </div>
    );
  }
  return null;
}

/* ─── Empty state ───────────────────────────────────────────────────────────── */
function Empty({ count }) {
  if (count === 0) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: T.accentSoft,
        border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center",
        justifyContent: "center", color: "#818cf8", animation: "float 3s ease-in-out infinite",
      }}>
        <Ic d={IC.file} size={32} sw={1.2} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: T.t1, marginBottom: 8 }}>
          Upload a document to begin
        </div>
        <div style={{ fontSize: 14, color: T.t2, maxWidth: 340, lineHeight: 1.65 }}>
          Nexus uses multi-query expansion, MMR and LLM re-ranking to give precise cited answers from your PDFs.
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
        {["Multi-query expansion", "MMR diversity filter", "LLM re-ranking", "Streaming answers", "Inline citations"].map(f => (
          <span key={f} style={{
            fontSize: 11, padding: "4px 11px", borderRadius: 20,
            background: T.accentSoft, border: `1px solid ${T.accentBorder}`, color: "#a5b4fc",
          }}>{f}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: T.accentSoft,
        border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center",
        justifyContent: "center", color: "#818cf8", animation: "float 3s ease-in-out infinite",
      }}>
        <Ic d={IC.sparkle} size={24} sw={1.5} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.t1, marginBottom: 5 }}>
          Ask anything about your documents
        </div>
        <div style={{ fontSize: 13, color: T.t3 }}>
          {count} document{count > 1 ? "s" : ""} ready · Press Enter to send
        </div>
      </div>
    </div>
  );
}

/* ─── Paper chip (sidebar) ──────────────────────────────────────────────────── */
function PaperChip({ paper, selected, onToggle, onDelete, deleting }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: selected ? T.accentSoft : "transparent",
      border: `1px solid ${selected ? T.accentBorder : T.border}`,
      borderRadius: 8, overflow: "hidden", transition: "all .15s",
    }}>
      <button onClick={() => onToggle(paper.id)} style={{
        flex: 1, background: "none", border: "none", cursor: "pointer",
        padding: "8px 10px", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
          background: selected ? T.accent : T.t3,
          boxShadow: selected ? `0 0 6px ${T.accent}` : "none",
          transition: "all .15s",
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500,
            color: selected ? T.t1 : T.t2,
            lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {paper.title || paper.filename}
          </div>
          <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>
            {paper.totalPages}p · {paper.totalChunks} chunks{paper.year ? ` · ${paper.year}` : ""}
          </div>
        </div>
      </button>
      <button onClick={() => onDelete(paper.id)} disabled={deleting === paper.id}
        style={{ background: "none", border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", padding: "8px 9px", color: T.t3, transition: "color .15s" }}
        onMouseEnter={e => e.currentTarget.style.color = T.red}
        onMouseLeave={e => e.currentTarget.style.color = T.t3}
      >
        {deleting === paper.id ? <Spinner size={11} color={T.red} /> : <Ic d={IC.trash} size={11} />}
      </button>
    </div>
  );
}

/* ─── Pipeline config ───────────────────────────────────────────────────────── */
function PipelineCfg({ cfg, onChange }) {
  const [open, setOpen] = useState(false);
  const tog = k => onChange({ ...cfg, [k]: !cfg[k] });
  const set = (k, v) => onChange({ ...cfg, [k]: v });

  const Toggle = ({ label, desc, k }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>{label}</div>
        <div style={{ fontSize: 10, color: T.t3, marginTop: 1 }}>{desc}</div>
      </div>
      <button onClick={() => tog(k)} style={{
        width: 36, height: 19, borderRadius: 10, border: "none", cursor: "pointer",
        background: cfg[k] ? T.accent : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background .2s", flexShrink: 0,
      }}>
        <div style={{
          width: 13, height: 13, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: cfg[k] ? 20 : 3,
          transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </button>
    </div>
  );

  const Slider = ({ label, k, min, max, step }) => (
    <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>{cfg[k]}</div>
      </div>
      <input type="range" min={min} max={max} step={step} value={cfg[k]}
        onChange={e => set(k, Number(e.target.value))}
        style={{ width: "100%", accentColor: T.accent, cursor: "pointer" }} />
    </div>
  );

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "none", border: "none", cursor: "pointer",
        padding: "9px 14px", display: "flex", alignItems: "center", gap: 7, color: T.t3,
      }}>
        <Ic d={IC.layers} size={13} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
          Pipeline Config
        </span>
        <div style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <Ic d={IC.chevron} size={12} />
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <Toggle label="Query Expansion" desc="2 extra query variants" k="useQueryExpansion" />
          <Toggle label="MMR Re-ranking" desc="Diversity filter" k="useMMR" />
          <Toggle label="LLM Re-ranking" desc="Score by relevance" k="useReranking" />
          <Slider label="Top-K Results" k="topK" min={3} max={15} step={1} />
          <div style={{ marginTop: 9, padding: "7px 9px", background: T.accentSoft, borderRadius: 7, border: `1px solid ${T.accentBorder}` }}>
            <div style={{ fontSize: 10, color: T.t3, lineHeight: 1.5 }}>
              ⚠ Chunk settings apply on next upload only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/*  MAIN APP                                                                    */
/* ════════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const { toasts, add: toast, rm: rmToast } = useToasts();
  const { papers, loading: papersLoading, reload: reloadPapers } = usePapers();

  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [streaming,    setStreaming]    = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [deleting,     setDeleting]     = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [uploadName,   setUploadName]   = useState(null);

  // Which message's sources to show in the right panel
  const [activePanel, setActivePanel] = useState(null); // message id

  const [pipelineCfg, setPipelineCfg] = useState({
    useQueryExpansion: true,
    useMMR:            true,
    useReranking:      true,
    topK:              5,
    chunkSize:         1000,
    chunkOverlap:      200,
  });

  const abortRef     = useRef(null);
  const bottomRef    = useRef(null);
  const fileRef      = useRef(null);
  const textareaRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // Auto-show sources panel for latest assistant message
  useEffect(() => {
    const last = [...messages].reverse().find(m => m.role === "assistant" && (m.sources?.length || m.confidence != null));
    if (last) setActivePanel(last.id);
  }, [messages]);

  const toggleSelect = useCallback(id => {
    setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const selectAll = () => setSelectedIds(new Set(papers.map(p => p.id)));
  const clearAll  = () => setSelectedIds(new Set());

  /* ── Upload ─────────────────────────────────────────────────────────────── */
  const handleUpload = async (files) => {
    const list = Array.from(files).filter(f => f.type === "application/pdf");
    if (!list.length) { toast("Only PDF files are supported"); return; }
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      setUploadName(file.name);
      try {
        const fd = new FormData();
        fd.append("file", file);
        await api.uploadPaper(fd);
        ok++;
      } catch (err) { toast(`Failed: "${file.name}": ${err.message}`); }
    }
    setUploading(false);
    setUploadName(null);
    if (ok > 0) { toast(`Uploaded ${ok} file${ok > 1 ? "s" : ""}`, "success"); reloadPapers(); }
  };

  const onDrop = useCallback(e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }, []);

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const handleDelete = async id => {
    setDeleting(id);
    try {
      await api.deletePaper(id);
      setSelectedIds(p => { const n = new Set(p); n.delete(id); return n; });
      reloadPapers();
      toast("Paper deleted", "success");
    } catch (err) { toast(`Delete failed: ${err.message}`); }
    finally { setDeleting(null); }
  };

  /* ── Send ───────────────────────────────────────────────────────────────── */
  const handleSend = async () => {
    const q = input.trim();
    if (!q || streaming) return;
    if (!papers.length) { toast("Upload at least one document first"); return; }

    setInput("");
    const uid = newId();
    const aid = newId();
    setMessages(p => [...p,
      { id: uid, role: "user",      content: q },
      { id: aid, role: "assistant", content: "", streaming: true, pipelineStep: 0 },
    ]);
    setStreaming(true);

    const stepTimer = setInterval(() => {
      setMessages(p => p.map(m =>
        m.id === aid && m.pipelineStep < 2 ? { ...m, pipelineStep: m.pipelineStep + 1 } : m));
    }, 1800);

    const paperIds = selectedIds.size > 0 ? [...selectedIds] : null;

    abortRef.current = await queryStream(
      { question: q, paperIds, ...pipelineCfg },
      {
        onToken: t => {
          clearInterval(stepTimer);
          setMessages(p => p.map(m => m.id === aid ? { ...m, content: m.content + t, pipelineStep: 3 } : m));
        },
        onMeta: meta => {
          setMessages(p => p.map(m => m.id === aid
            ? { ...m, sources: meta.sources, confidence: meta.confidence, expandedQueries: meta.expandedQueries, timings: meta.timings }
            : m));
        },
        onDone: ({ processingTimeMs }) => {
          clearInterval(stepTimer);
          setMessages(p => p.map(m => m.id === aid ? { ...m, streaming: false, processingTimeMs } : m));
          setStreaming(false);
        },
        onError: msg => {
          clearInterval(stepTimer);
          setMessages(p => p.map(m => m.id === aid ? { ...m, role: "error", content: msg, streaming: false } : m));
          setStreaming(false);
        },
      }
    );
  };

  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && streaming)  { abortRef.current?.abort(); setStreaming(false); }
  };

  const clearChat = () => { if (!streaming) { setMessages([]); setActivePanel(null); } };

  /* ── Active panel message ────────────────────────────────────────────────── */
  const panelMsg = activePanel ? messages.find(m => m.id === activePanel) : null;

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.t1, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

      {/* ══════════════════════════════════════════════════════ SIDEBAR ═══ */}
      <div style={{
        width: sidebarOpen ? 240 : 0, minWidth: sidebarOpen ? 240 : 0,
        transition: "all .25s ease", overflow: "hidden",
        borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column",
        background: T.sidebar,
      }}>
        {/* Logo */}
        <div style={{ padding: "16px 14px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <img src="/logo.png" alt="Nexus" style={{ width: 34, height: 34, borderRadius: 8, boxShadow: `0 2px 12px rgba(99,102,241,0.4)`, objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-.02em", background: "linear-gradient(90deg,#c7d2fe,#a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                NEXUS RAG
              </div>
              <div style={{ fontSize: 9, color: T.t3, letterSpacing: ".07em" }}>RESEARCH AI</div>
            </div>
          </div>

          {/* Upload zone */}
          <div
            onDrop={onDrop} onDragOver={e => e.preventDefault()}
            onClick={() => !uploading && fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${T.accentBorder}`, borderRadius: 10,
              padding: "13px 10px", textAlign: "center", cursor: "pointer",
              background: T.accentSoft, marginBottom: 14, transition: "all .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.accentBorder}
          >
            <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: "none" }}
              onChange={e => { handleUpload(e.target.files); e.target.value = ""; }} />
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <Spinner size={20} />
                <div style={{ fontSize: 11, color: "#a5b4fc" }}>
                  {uploadName ? `Processing ${uploadName.slice(0, 20)}…` : "Uploading…"}
                </div>
              </div>
            ) : (
              <>
                <div style={{ color: "#818cf8", marginBottom: 5 }}><Ic d={IC.upload} size={20} sw={1.5} /></div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>Drop PDFs or click to upload</div>
                <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Multiple files supported</div>
              </>
            )}
          </div>

          {/* Paper count + actions */}
          {papers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Papers ({papers.length})
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                <button onClick={selectAll} style={{ fontSize: 10, color: T.t3, background: "none", border: "none", cursor: "pointer" }}>All</button>
                <button onClick={clearAll}  style={{ fontSize: 10, color: T.t3, background: "none", border: "none", cursor: "pointer" }}>None</button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable paper list + pipeline config */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0 14px 14px" }}>
            {papersLoading ? (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}><Spinner /></div>
            ) : papers.length === 0 ? (
              <div style={{ fontSize: 11, color: T.t3, textAlign: "center", paddingTop: 10 }}>No documents yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {papers.map(p => (
                  <PaperChip key={p.id} paper={p} selected={selectedIds.has(p.id)}
                    onToggle={toggleSelect} onDelete={handleDelete} deleting={deleting} />
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {papers.length > 0 && (
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.t3, textAlign: "center" }}>
                {selectedIds.size === 0
                  ? "All papers will be searched"
                  : `Searching ${selectedIds.size} selected paper${selectedIds.size > 1 ? "s" : ""}`}
              </div>
            </div>
          )}
          <PipelineCfg cfg={pipelineCfg} onChange={setPipelineCfg} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ CHAT AREA ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: "0 16px", height: 52, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          background: "rgba(13,15,23,0.8)", backdropFilter: "blur(12px)",
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
            borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: T.t2, transition: "all .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <Ic d={IC.menu} size={15} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Research Chat</div>
            <div style={{ fontSize: 10, color: T.t3 }}>Groq · LLaMA 3.1 · Qdrant · Local Embeddings</div>
          </div>

          {/* Panel toggle (when sources exist) */}
          {panelMsg && (
            <button onClick={() => setActivePanel(p => p ? null : panelMsg.id)} style={{
              background: T.accentSoft, border: `1px solid ${T.accentBorder}`,
              borderRadius: 7, padding: "5px 9px", cursor: "pointer", color: "#a5b4fc",
              fontSize: 11, display: "flex", alignItems: "center", gap: 5, transition: "all .15s",
            }}>
              <Ic d={IC.panel} size={13} />
              Sources
            </button>
          )}

          {messages.length > 0 && (
            <button onClick={clearChat} disabled={streaming} style={{
              background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
              borderRadius: 7, padding: "5px 10px", cursor: "pointer",
              color: T.t3, fontSize: 11, display: "flex", alignItems: "center", gap: 5, transition: "all .15s",
            }}>
              <Ic d={IC.x} size={11} /> Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 0 8px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
            {messages.length === 0 ? (
              <Empty count={papers.length} />
            ) : (
              messages.map(m => <Bubble key={m.id} msg={m} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div style={{ padding: "12px 16px 16px", flexShrink: 0, background: T.bg }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 8,
              background: T.surface, border: `1px solid ${T.borderMid}`,
              borderRadius: 14, padding: "10px 12px",
              boxShadow: "0 2px 20px rgba(0,0,0,0.3)", transition: "border-color .15s",
            }}
              onFocus={() => {}}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your documents…"
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: T.t1, fontSize: 14, lineHeight: 1.6, resize: "none",
                  fontFamily: "inherit", minHeight: 22,
                  "::placeholder": { color: T.t3 },
                }}
              />
              <button
                onClick={streaming ? () => { abortRef.current?.abort(); setStreaming(false); } : handleSend}
                style={{
                  width: 34, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                  background: streaming ? "rgba(248,113,113,0.15)" : (input.trim() ? T.accent : "rgba(255,255,255,0.07)"),
                  color: streaming ? T.red : (input.trim() ? "#fff" : T.t3),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s", flexShrink: 0,
                }}
              >
                {streaming ? <Ic d={IC.stop} size={13} fill="currentColor" sw={0} /> : <Ic d={IC.send} size={14} />}
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 7, fontSize: 10, color: T.t3 }}>
              Enter to send · Shift+Enter for newline · Esc to stop
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ SOURCES PANEL ═══ */}
      {panelMsg && activePanel && (
        <SourcesPanel msg={panelMsg} />
      )}

      <Toasts toasts={toasts} rm={rmToast} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        textarea::placeholder { color: rgba(255,255,255,0.25); }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .markdown-body h1,.markdown-body h2,.markdown-body h3 { color: rgba(255,255,255,0.92); font-weight:700; margin:.9em 0 .4em; }
        .markdown-body h1 { font-size:1.3em; }
        .markdown-body h2 { font-size:1.15em; }
        .markdown-body h3 { font-size:1.05em; }
        .markdown-body p  { margin:.5em 0; }
        .markdown-body ul,.markdown-body ol { padding-left:1.4em; margin:.5em 0; }
        .markdown-body li { margin:.25em 0; }
        .markdown-body code { background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); border-radius:5px; padding:2px 6px; font-size:.88em; font-family:'Fira Code',monospace; color:#c7d2fe; }
        .markdown-body pre  { background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px 16px; overflow-x:auto; }
        .markdown-body pre code { background:none; border:none; padding:0; color:rgba(255,255,255,0.8); }
        .markdown-body blockquote { border-left:3px solid rgba(99,102,241,0.5); padding-left:12px; color:rgba(255,255,255,0.55); margin:.5em 0; }
        .markdown-body strong { color:rgba(255,255,255,0.95); font-weight:600; }
        .markdown-body a { color:#a5b4fc; text-decoration:none; }
        .markdown-body a:hover { text-decoration:underline; }
        .markdown-body table { border-collapse:collapse; width:100%; margin:.6em 0; }
        .markdown-body th { background:rgba(99,102,241,0.12); color:rgba(255,255,255,0.85); font-weight:600; padding:7px 11px; border:1px solid rgba(255,255,255,0.08); text-align:left; font-size:12px; }
        .markdown-body td { padding:6px 11px; border:1px solid rgba(255,255,255,0.06); font-size:13px; color:rgba(255,255,255,0.7); }
        .markdown-body tr:nth-child(even) td { background:rgba(255,255,255,0.02); }
      `}</style>
    </div>
  );
}
