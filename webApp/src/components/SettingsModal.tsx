// src/components/SettingsModal.tsx
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;
    return (
        <div style={backdrop}>
            <div style={sheet}>
                <h2 style={{ marginTop: 0 }}>Settings</h2>
                <p style={{ fontSize: 14, color: "#444" }}>
                    <b>Providers:</b> Choose model in Run Panel. For OpenAI/Gemini/Llama.cpp, set API keys on the <i>server</i> (env vars).
                </p>
                <ul style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
                    <li><code>OPENAI_API_KEY</code></li>
                    <li><code>GEMINI_API_KEY</code></li>
                    <li>Llama.cpp: point your server to local socket/binary (coming next).</li>
                </ul>
                <div style={{ textAlign: "right", marginTop: 16 }}>
                    <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff" }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center" };
const sheet: React.CSSProperties = { width: "min(720px, 92vw)", background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" };
