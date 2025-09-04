// src/components/Library.tsx
import { useEffect, useState } from "react";
import { listPrompts, onPromptsChange, deletePrompt, PromptItem } from "../lib/storage";

export default function Library({ onLoad }: { onLoad: (p: PromptItem) => void }) {
    const [items, setItems] = useState<PromptItem[]>([]);

    function refresh() { setItems(listPrompts()); }
    useEffect(() => {
        refresh();
        return onPromptsChange(refresh);
    }, []);

    return (
        <div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Library</h2>
            {items.length === 0 ? (
                <div style={{ fontSize: 13, color: "#666" }}>No saved prompts yet.</div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {items.map(p => (
                        <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontWeight: 600, flex: 1 }}>{p.title}</div>
                                <button onClick={() => onLoad(p)} style={smallBtn}>Load</button>
                                <button onClick={() => deletePrompt(p.id)} style={smallGhost}>Delete</button>
                            </div>
                            <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 12, color: "#444" }}>
                {p.body.length > 240 ? p.body.slice(0, 240) + "…" : p.body}
              </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const smallBtn: React.CSSProperties   = { padding: "6px 10px", borderRadius: 6, background: "#111", color: "#fff", border: "1px solid #111" };
const smallGhost: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, background: "#fff", color: "#111", border: "1px solid #111" };
