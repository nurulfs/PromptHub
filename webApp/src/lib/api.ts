// src/lib/api.ts
export async function resolveApiBase(): Promise<string> {
    // dev: frontend on :8080, backend on :5555
    return "http://localhost:5555";
}

// ---------- models ----------
export async function listModels(apiBase: string, provider: "lmstudio"): Promise<string[]> {
    const url = `${apiBase}/api/models?provider=${provider}`;
    try {
        // simple GET — no custom headers → no CORS preflight
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
            console.error("[listModels] HTTP", res.status, res.statusText);
            return [];
        }
        const j = await res.json();
        const arr = Array.isArray(j?.models) ? j.models : [];
        if (!Array.isArray(j?.models)) console.error("[listModels] Unexpected payload:", j);
        console.log("[listModels] models =>", arr);
        return arr;
    } catch (err) {
        console.error("[listModels] fetch error", err);
        return [];
    }
}


// ---------- runs ----------
export async function startRun(
    apiBase: string,
    body: { prompt: string; input?: string; model: string }
): Promise<{ runId: string }> {
    const res = await fetch(`${apiBase}/api/test/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`startRun failed: ${res.status}`);
    return res.json();
}

// src/lib/api.ts
export function streamRun(
    base: string,
    runId: string,
    onToken: (t: string) => void,
    onDone?: () => void
) {
    const url = `${base}/api/test/stream/${encodeURIComponent(runId)}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
        // server escapes newlines as \\n; restore them
        const t = (ev.data ?? "").replaceAll("\\n", "\n");
        if (t) onToken(t);
    };

    es.addEventListener("done", () => {
        es.close();
        onDone?.();
    });

    es.onerror = () => {
        // Connection dropped; stop trying—this run is single-consumer.
        es.close();
        onDone?.();
    };

    // return cancel fn
    return () => es.close();
}




