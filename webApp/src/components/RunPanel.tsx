import { useEffect, useRef, useState } from "react";
import { listModels, resolveApiBase, startRun, streamRun } from "../lib/api";
import TemplateGallery from "./TemplateGallery";
import Library from "./Library";
import StatusBar from "./StatusBar";
import { PromptItem, upsertPrompt } from "../lib/storage";
import SettingsModal from "./SettingsModal";
import PromptBuilder from "./PromptBuilder";
import MarkdownPane from "./MarkdownPane";
import FuturisticBG from "./FuturisticBG";

export default function RunPanel() {
    const [apiBase, setApiBase] = useState<string>("");
    const [title, setTitle] = useState("Untitled");
    const [prompt, setPrompt] = useState("Write a 2-line haiku about Kotlin.");
    const [input, setInput] = useState("");

    const [provider, setProvider] = useState<"lmstudio" | "demo">("lmstudio");
    const [models, setModels] = useState<string[]>([]);
    const [modelName, setModelName] = useState<string>("");
    const [modelsLoading, setModelsLoading] = useState<boolean>(false);
    const [modelsError, setModelsError] = useState<string>("");

    const [output, setOutput] = useState("");
    const [busy, setBusy] = useState(false);
    const stopRef = useRef<(() => void) | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        (async () => setApiBase(await resolveApiBase()))();
    }, []);

    async function fetchModels() {
        if (!apiBase || provider !== "lmstudio") return;
        setModelsLoading(true);
        setModelsError("");
        const list = await listModels(apiBase, "lmstudio");
        setModels(list);
        setModelName(prev => (prev && list.includes(prev) ? prev : (list[0] ?? "")));
        if (list.length === 0) setModelsError("Could not load from /api/models");
        setModelsLoading(false);
    }

    useEffect(() => {
        if (!apiBase) return;
        if (provider !== "lmstudio") {
            setModels([]);
            setModelName("");
            return;
        }
        fetchModels();
    }, [apiBase, provider]);

    async function handleRun() {
        setOutput("");
        setBusy(true);
        try {
            const modelSpec = provider === "demo" ? "demo" : `lmstudio:${modelName || ""}`;
            if (provider === "lmstudio" && !modelName) {
                setBusy(false);
                setOutput("Error: No LM Studio model selected. Start LM Studio, load a model, then pick it here.");
                return;
            }
            const { runId } = await startRun(apiBase || "", { prompt, input, model: modelSpec });
            stopRef.current = streamRun(apiBase || "", runId, (t) => setOutput((s) => s + t), () => setBusy(false));
        } catch (e) {
            setBusy(false);
            setOutput("Error: " + String(e));
        }
    }

    function handleStop() {
        stopRef.current?.();
        setBusy(false);
    }

    function handleUseTemplate(body: string, tplTitle: string) {
        setPrompt(body);
        if (!title || title === "Untitled") setTitle(tplTitle);
    }

    function handleSave() {
        upsertPrompt({ title: title || "Untitled", body: prompt });
    }

    function handleLoad(p: PromptItem) {
        setTitle(p.title);
        setPrompt(p.body);
    }

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* Background stays fixed and behind everything */}
            <FuturisticBG opacity={0.9} />

            {/* Main UI sits above the background */}
            <div style={{ position: "relative", zIndex: 1, margin: "0 auto", maxWidth: 20000, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Prompt-Hub -- Desktop</h1>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button onClick={() => setShowSettings(true)} style={btnGhost}>Settings</button>
                        <a
                            href="https://github.com/Siddhesh2377/PromptHub"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                ...btnGhost,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center"
                            }}
                        >
                            GitHub
                        </a>
                    </div>
                </div>

                <StatusBar apiBase={apiBase} />

                <div
                    style={{
                        display: "grid",
                        gap: 18,
                        marginTop: 18,
                        marginBottom: 18,
                        gridTemplateColumns: "1fr 1fr",
                    }}
                >
                    {/* Editor */}
                    <section style={card}>
                        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr" }}>
                            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 480px" }}>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Title"
                                    style={inputStyle}
                                />
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <select
                                        value={provider}
                                        onChange={(e) => setProvider(e.target.value as any)}
                                        style={{ ...inputStyle, padding: 8 }}
                                    >
                                        <option value="lmstudio">lmstudio</option>
                                        <option value="demo">demo</option>
                                    </select>

                                    {provider === "lmstudio" && (
                                        <>
                                            <select
                                                value={modelName}
                                                onChange={(e) => setModelName(e.target.value)}
                                                onFocus={() => {
                                                    if (models.length === 0 && !modelsLoading) fetchModels();
                                                }}
                                                style={{ ...inputStyle, padding: 8, minWidth: 240 }}
                                                disabled={modelsLoading || models.length === 0}
                                            >
                                                {modelsLoading ? (
                                                    <option value="">(loading models…)</option>
                                                ) : models.length === 0 ? (
                                                    <option value="">(no models — could not load)</option>
                                                ) : (
                                                    models.map((m) => (
                                                        <option key={m} value={m}>
                                                            {m}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                            <button onClick={fetchModels} style={btnGhost} title="Refresh models">
                                                ↻
                                            </button>
                                        </>
                                    )}

                                    <button onClick={handleSave} style={btn}>Save</button>
                                </div>
                            </div>

                            {modelsError && (
                                <div style={{ fontSize: 12, color: "#b00" }}>
                                    {modelsError} (see browser console → Network for /api/models)
                                </div>
                            )}

                            <label style={label}>Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                style={{ ...inputStyle, minHeight: 160 }}
                            />

                            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 160px" }}>
                                <div>
                                    <label style={label}>Input (optional)</label>
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                                    {!busy ? (
                                        <button
                                            onClick={handleRun}
                                            disabled={(provider === "lmstudio" && !modelName) || modelsLoading}
                                            style={{
                                                ...btn,
                                                width: "100%",
                                                opacity: (provider === "lmstudio" && !modelName) || modelsLoading ? 0.6 : 1,
                                            }}
                                        >
                                            Run
                                        </button>
                                    ) : (
                                        <button onClick={handleStop} style={{ ...btnGhost, width: "100%" }}>
                                            Stop
                                        </button>
                                    )}
                                </div>
                            </div>

                            <label style={label}>Streamed Output</label>
                            <MarkdownPane markdown={output || "_Run a prompt to see output here…_"} />
                        </div>
                    </section>

                    {/* Prompt Builder */}
                    <section style={card}>
                        <PromptBuilder onInsert={(p) => setPrompt(p)} />
                    </section>

                    {/* Templates + Library */}
                    <section
                        style={{
                            display: "grid",
                            gap: 18,
                            gridTemplateColumns: "1fr 1fr",
                            gridColumn: "1 / -1",
                        }}
                    >
                        <div style={card}>
                            <TemplateGallery onUse={handleUseTemplate} currentPrompt={{ title, body: prompt }} />
                        </div>
                        <div style={card}>
                            <Library onLoad={handleLoad} />
                        </div>
                    </section>
                </div>

                <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
            </div>
        </div>
    );
}

/* ---- STYLES ---- */
const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.06)"
};
const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff"
};
const label: React.CSSProperties = { fontSize: 12, color: "#666" };
const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#111",
    color: "#fff",
    border: "1px solid #111"
};
const btnGhost: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#fff",
    color: "#111",
    border: "1px solid #111"
};
