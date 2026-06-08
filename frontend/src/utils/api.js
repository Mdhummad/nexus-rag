const BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

async function req(method, path, body) {
    const opts = {
        method,
        headers: body instanceof FormData ? {} : { "Content-Type": "application/json" },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    };
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Request failed");
    }
    return res.json();
}

export const api = {
    health: () => req("GET", "/health"),
    getPapers: () => req("GET", "/papers"),
    uploadPaper: (file) => { const fd = new FormData(); fd.append("file", file); return req("POST", "/papers/upload", fd); },
    deletePaper: (id) => req("DELETE", `/papers/${id}`),
    analyzePaper: (id, analysisType) => req("POST", `/papers/${id}/analyze`, { analysisType }),
    query: (body) => req("POST", "/query", body),
};