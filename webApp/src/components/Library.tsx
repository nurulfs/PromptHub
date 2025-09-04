// src/components/Library.tsx
import {useEffect, useState} from "react";
import {deletePrompt, listPrompts, onPromptsChange, PromptItem} from "../lib/storage";
import HoverButton from "./HoveredButton.tsx";

export default function Library({onLoad}: { onLoad: (p: PromptItem) => void }) {
    const [items, setItems] = useState<PromptItem[]>([]);

    function refresh() {
        setItems(listPrompts());
    }

    useEffect(() => {
        refresh();
        return onPromptsChange(refresh);
    }, []);

    return (
        <div>
            <h2 style={{fontSize: 18, marginBottom: 8}}>Library</h2>
            {items.length === 0 ? (
                <div style={{fontSize: 13, color: "#666"}}>No saved prompts yet.</div>
            ) : (
                <div style={{
                    display: "grid",
                    gap: 20,
                }}>
                    {items.map(p => (
                        <div key={p.id} style={{border: "2px solid #FFFFFF", borderRadius: 20, padding: 10}}>
                            <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <div style={{fontWeight: 600, flex: 1}}>{p.title}</div>
                                <HoverButton baseStyle={btn}
                                             hoverStyle={btnHover}
                                             onClick={() => onLoad(p)}>
                                    Load
                                </HoverButton>
                                <HoverButton baseStyle={btnGhost}
                                             hoverStyle={btnGhostHover}
                                             onClick={() => deletePrompt(p.id)}>
                                    Delete
                                </HoverButton>
                            </div>
                            <pre style={{marginTop: 6, whiteSpace: "pre-wrap", fontSize: 12, color: "#444"}}>
                                {p.body.length > 240 ? p.body.slice(0, 240) + "…" : p.body}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const btnGhost: React.CSSProperties = {
    padding: "10px 24px",
    borderRadius: 26,
    background: "#fff",
    color: "#111",
    border: "1px solid transparent",
};

const btnGhostHover: React.CSSProperties = {
    border: "1px solid #111",
    borderRadius: 8,
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
};

const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 26,
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
};
const btnHover: React.CSSProperties = {
    transform: "translateY(-1px)",
    borderRadius: 8,
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
};

