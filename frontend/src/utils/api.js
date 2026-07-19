const BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

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

export const api = {
    health:      ()          => req("GET",    "/health"),
    getPapers:   ()          => req("GET",    "/papers"),
    uploadPaper: (form, sig) => req("POST",   "/papers/upload",       form,       sig),
    deletePaper: (id)        => req("DELETE", `/papers/${id}`),
    analyzePaper:(id, type)  => req("POST",   `/papers/${id}/analyze`, { analysisType: type }),
    query:       (body)      => req("POST",   "/query",                body),
};

/**
 * Streaming query via SSE.
 * Calls onToken(str) for each streamed token,
 * onMeta({ sources, confidence, expandedQueries, timings }) once retrieval is done,
 * onDone({ processingTimeMs }) when complete,
 * onError(message) on failure.
 * Returns an AbortController so the caller can cancel.
 */
export async function queryStream(body, { onToken, onMeta, onDone, onError }) {
    const controller = new AbortController();

    try {
        const res = await fetch(`${BASE}/query/stream`, {
            method:  "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body:    JSON.stringify(body),
            signal:  controller.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            onError(err.error || "Stream request failed");
            return controller;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                    const evt = JSON.parse(line.slice(6));
                    if (evt.type === "token") onToken(evt.content);
                    if (evt.type === "meta")  onMeta(evt);
                    if (evt.type === "done")  onDone(evt);
                    if (evt.type === "error") onError(evt.message);
                } catch { /* skip malformed */ }
            }
        }
    } catch (err) {
        if (err.name !== "AbortError") onError(err.message);
    }

    return controller;
}