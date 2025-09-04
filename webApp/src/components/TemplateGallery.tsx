// src/components/TemplateGallery.tsx
import { useEffect, useMemo, useState } from "react";
import { listUserTemplates, onTemplatesChange, upsertUserTemplate, deleteUserTemplate } from "../lib/storage";

type T = { id: string; title: string; desc: string; body: string; tags?: string[] };

const BUILT_INS: T[] = [
    { id:"blog-outline", title:"Blog Outline", desc:"Generate an outline with headings and key points.", tags:["content","blog"],
        body:`Role: Expert content strategist
Task: Create a clean outline with 6–8 sections
Audience: Beginners
Style: Clear, concise
Constraints: Use H2/H3, include key bullets per section
Topic: <insert your topic>` },
    { id:"yt-script", title:"YouTube Script", desc:"Structured script with hook, segments, CTA.", tags:["video","script"],
        body:`Role: YouTube scriptwriter
Task: Write a 4-minute script with hook → 3 points → recap → CTA
Tone: Friendly, energetic
Constraints: Add timestamps, keep sentences short
Subject: <insert subject>` },
    { id:"bug-report", title:"Bug Report Formatter", desc:"Turn rough notes into a clean bug report.", tags:["dev","qa"],
        body:`Role: QA triage assistant
Task: Normalize a bug report
Fields: Title, Steps to Reproduce, Expected, Actual, Screenshots, Environment
Constraints: Be specific, avoid assumptions
Raw notes: <paste notes>` },
    { id:"sql-helper", title:"SQL Helper", desc:"Generate SQL with explanation.", tags:["data","sql"],
        body:`Role: SQL expert
Task: Write SQL and explain line-by-line
DB: <Postgres/MySQL>
Schema: <paste schema/tables>
Question: <what you want>
Constraints: Safe operations only, no destructive queries` },
    { id:"resume-bullets", title:"Resume Bullets", desc:"Rewrite bullets with impact (STAR).", tags:["career"],
        body:`Role: Resume coach
Task: Rewrite bullets using strong verbs + metrics (STAR)
Constraints: 1–2 lines per bullet, quantify impact
Raw bullets: <paste>` },
    { id:"email-draft", title:"Email Draft", desc:"Polite, concise email with options.", tags:["email","biz"],
        body:`Role: Professional email assistant
Task: Draft a concise email with 2 subject options
Tone: Polite, clear
Context: <recipient, purpose, ask, deadline>
Constraints: 150 words max` },
];

export default function TemplateGallery({
                                            onUse,
                                            currentPrompt,
                                        }: {
    onUse: (body: string, title: string) => void;
    currentPrompt?: { title: string; body: string };
}) {
    const [tab, setTab] = useState<"builtin" | "mine">("builtin");
    const [mine, setMine] = useState(returnMine());
    const [query, setQuery] = useState("");

    function returnMine() { return listUserTemplates(); }
    useEffect(() => onTemplatesChange(() => setMine(returnMine())), []);

    const filteredBuiltins = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return BUILT_INS;
        return BUILT_INS.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.desc.toLowerCase().includes(q) ||
            (t.tags||[]).some(x => x.toLowerCase().includes(q)),
        );
    }, [query]);

    const filteredMine = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return mine;
        return mine.filter(t =>
            t.title.toLowerCase().includes(q) ||
            (t.desc||"").toLowerCase().includes(q) ||
            (t.tags||[]).some(x => x.toLowerCase().includes(q)),
        );
    }, [mine, query]);

    function card(t: { id: string; title: string; desc?: string; body: string; tags?: string[] }, deletable?: boolean) {
        return (
            <div key={t.id} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 12, background: "#fff" }}>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                {t.desc && <div style={{ fontSize: 13, color: "#555", margin: "6px 0 10px" }}>{t.desc}</div>}
                <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => onUse(t.body, t.title)} style={btn}>Use</button>
                    {deletable && <button onClick={() => deleteUserTemplate(t.id)} style={btnGhost}>Delete</button>}
                </div>
            </div>
        );
    }

    function saveCurrentAsTemplate() {
        const title = (currentPrompt?.title || "Untitled").trim();
        const body  = (currentPrompt?.body || "").trim();
        if (!body) return;
        const desc  = prompt("Short description for this template?", "");
        upsertUserTemplate({ title, body, desc: desc || undefined, tags: [] });
        setTab("mine");
    }

    return (
        <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <h2 style={{ fontSize: 18, margin: 0 }}>Templates</h2>
                <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search…" style={input}/>
                    <button onClick={()=>setTab("builtin")} style={tabBtn(tab==="builtin")}>Built-in</button>
                    <button onClick={()=>setTab("mine")} style={tabBtn(tab==="mine")}>My Templates</button>
                    <button onClick={saveCurrentAsTemplate} style={btnGhost} title="Save current editor as template">Save current → Template</button>
                </div>
            </div>

            {tab==="builtin" ? (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    {filteredBuiltins.map(t => card(t))}
                </div>
            ) : (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    {filteredMine.length === 0 ? (
                        <div style={{ fontSize: 13, color:"#666" }}>No templates yet. Use “Save current → Template”.</div>
                    ) : filteredMine.map(t => card(t, true))}
                </div>
            )}
        </div>
    );
}

const input: React.CSSProperties = { width: 220, padding: 8, border: "1px solid #ddd", borderRadius: 8, fontSize: 14, background: "#fff" };
const btn: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff" };
const btnGhost: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #111", background: "#fff", color: "#111" };
const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 10px", borderRadius: 6, border: "1px solid #111",
    background: active ? "#111" : "#fff", color: active ? "#fff" : "#111"
});
