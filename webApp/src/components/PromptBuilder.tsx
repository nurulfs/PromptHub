// src/components/PromptBuilder.tsx
import {useMemo, useState} from "react";

export type BuilderState = {
    role?: string;
    task?: string;
    audience?: string;
    tone?: string;
    style?: string;
    constraints?: string;
    steps?: string;
    variables?: string;   // comma-separated, e.g. <product>, <goal>
    examples?: string;    // few-shot examples
    outputFormat?: string; // e.g. "JSON with fields x,y"
    length?: string;       // e.g. "150-200 words"
};

function composePrompt(s: BuilderState): string {
    const lines: string[] = [];
    if (s.role) lines.push(`Role: ${s.role}`);
    if (s.task) lines.push(`Task: ${s.task}`);
    if (s.audience) lines.push(`Audience: ${s.audience}`);
    if (s.tone) lines.push(`Tone: ${s.tone}`);
    if (s.style) lines.push(`Style: ${s.style}`);
    if (s.constraints) lines.push(`Constraints: ${s.constraints}`);
    if (s.steps) lines.push(`Process: ${s.steps}`);
    if (s.variables) lines.push(`Variables: ${s.variables}`);
    if (s.examples) lines.push(`Examples:\n${s.examples}`);
    if (s.outputFormat) lines.push(`Output format: ${s.outputFormat}`);
    if (s.length) lines.push(`Length: ${s.length}`);
    return lines.join("\n");
}

export default function PromptBuilder({
                                          onInsert,
                                          initial,
                                      }: {
    onInsert: (prompt: string) => void;
    initial?: Partial<BuilderState>;
}) {
    const [state, setState] = useState<BuilderState>({
        role: "Expert assistant",
        task: "",
        audience: "",
        tone: "Clear, concise",
        style: "",
        constraints: "",
        steps: "",
        variables: "<topic>",
        examples: "",
        outputFormat: "",
        length: "",
        ...initial,
    });

    const text = useMemo(() => composePrompt(state), [state]);

    function field(label: string, key: keyof BuilderState, placeholder?: string, multiline = false) {
        const common = {
            value: (state[key] as string) || "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setState(s => ({...s, [key]: e.target.value})),
            style: inputStyle,
            placeholder,
        };
        return (
            <div>
                <div style={labelStyle}>{label}</div>
                {multiline ? <textarea {...common as any} style={{...inputStyle, minHeight: 80}}/> :
                    <input {...common as any} />}
            </div>
        );
    }

    return (
        <div>
            <h2 style={{fontSize: 18, marginBottom: 8}}>Prompt Builder</h2>

            <div style={{display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr"}}>
                {field("Role", "role", "e.g., Senior product copywriter")}
                {field("Task", "task", "e.g., Write a landing page hero")}
                {field("Audience", "audience", "e.g., Founders evaluating AI tools")}
                {field("Tone", "tone", "e.g., Friendly, confident")}
                {field("Style", "style", "e.g., Short sentences, avoid jargon")}
                {field("Length", "length", "e.g., 150–200 words")}
                {field("Variables", "variables", "e.g., <product>, <benefit>")}
                {field("Output Format", "outputFormat", "e.g., JSON with fields: title, tagline")}
                {field("Constraints", "constraints", "e.g., No clichés, include CTA", true)}
                {field("Steps / Process", "steps", "e.g., Brainstorm → Draft → Polish", true)}
                {field("Examples (few-shot)", "examples", "Paste 1–2 great examples", true)}
            </div>

            <div style={{marginTop: 12}}>
                <div style={labelStyle}>Preview</div>
                <pre style={{
                    ...inputStyle,
                    whiteSpace: "pre-wrap",
                    minHeight: 120
                }}>{text || "Start filling fields…"}</pre>
            </div>

            <div style={{display: "flex", gap: 8}}>
                <button onClick={() => onInsert(text)} style={btn}>Insert into editor</button>
                <button onClick={() => {
                    navigator.clipboard.writeText(text);
                }} style={btnGhost}>Copy
                </button>
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff"
};
const labelStyle: React.CSSProperties = {fontSize: 12, color: "#666", marginBottom: 4};
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
