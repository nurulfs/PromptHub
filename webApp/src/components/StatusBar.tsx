// src/components/StatusBar.tsx
export default function StatusBar({ apiBase }: { apiBase: string }) {
    const ok = apiBase !== null; // present even if ""
    const usingLocalhost = apiBase.startsWith("http://localhost:");
    const text = apiBase
        ? `Server: ${apiBase} ${usingLocalhost ? "(local)" : "(same-origin)"}`
        : "Server not detected — demo mode";
    const bg = apiBase ? "#e7f7ee" : "#ffece6";
    const color = apiBase ? "#0a7a4b" : "#8a3000";

    return (
        <div style={{ background: bg, color, padding: "8px 12px", fontSize: 13, borderRadius: 8 }}>
            {text}
        </div>
    );
}
