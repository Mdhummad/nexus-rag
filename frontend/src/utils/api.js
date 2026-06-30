const BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

// Optional API key — set VITE_API_KEY in .env for production
const API_KEY = import.meta.env.VITE_API_KEY || null;

function authHeaders(extra = {}) {
    return API_KEY
        ? { "X-API-Key": API_KEY, ...extra }
        : extra;
}

async function req(method, path, body, signal) {
    const isForm = body instanceof FormData;
    const opts = {
        method,
        signal,
        headers: authHeaders(isForm ? {} : { "Content-Type": "application/json" }),
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
    };
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Request failed");
    }
    return res.json();
}

/**
 * Streaming query via SSE.
 * Calls onToken(str) for each streamed token,
 * onMeta({ sources, confidence, expandedQueries, timings }) once retrieval is done,
 * onDone({ processingTimeMs }) when complete,
 * onError(message) on failure.
 * Returns an AbortController so the caller can cancel.
 */
export async function queryStream(body, { onToken, onMeta, onDone, onError }, signal) {
    const res = await fetch(`${BASE}/query/stream`, {
        method: "POST",
        signal,
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Stream request failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();  // keep incomplete line in buffer

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "token") onToken?.(event.content);
                else if (event.type === "meta")  onMeta?.(event);
                else if (event.type === "done")  onDone?.(event);
                else if (event.type === "error") onError?.(event.message);
            } catch {
                // malformed line — skip
            }
        }
    }
}

export const api = {
    health:       ()             => req("GET",    "/health"),
    getPapers:    ()             => req("GET",    "/papers"),
    uploadPaper:  (file)         => { const fd = new FormData(); fd.append("file", file); return req("POST", "/papers/upload", fd); },
    deletePaper:  (id)           => req("DELETE", `/papers/${id}`),
    analyzePaper: (id, type)     => req("POST",   `/papers/${id}/analyze`, { analysisType: type }),
    query:        (body, signal) => req("POST",   "/query", body, signal),
    queryStream,
};