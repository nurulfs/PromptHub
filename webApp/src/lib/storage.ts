// src/lib/storage.ts
export type PromptItem = { id: string; title: string; body: string; updatedAt: number };

const PROMPTS_KEY = "ph.prompts.v1";
const TEMPLATES_KEY = "ph.templates.v1";
const EVT = "ph:library-change";
const TEVT = "ph:templates-change";

function read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}
function write<T>(key: string, val: T) {
    localStorage.setItem(key, JSON.stringify(val));
}

export function listPrompts(): PromptItem[] {
    return read<PromptItem[]>(PROMPTS_KEY, []).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function upsertPrompt(p: { id?: string; title: string; body: string }): PromptItem {
    const now = Date.now();
    const all = listPrompts();
    let item: PromptItem;
    if (p.id) {
        const idx = all.findIndex(x => x.id === p.id);
        if (idx >= 0) {
            all[idx] = { ...all[idx], title: p.title, body: p.body, updatedAt: now };
            item = all[idx];
        } else {
            item = { id: p.id, title: p.title, body: p.body, updatedAt: now };
            all.push(item);
        }
    } else {
        item = { id: crypto.randomUUID(), title: p.title, body: p.body, updatedAt: now };
        all.push(item);
    }
    write(PROMPTS_KEY, all);
    window.dispatchEvent(new CustomEvent(EVT));
    return item;
}
export function deletePrompt(id: string) {
    const all = listPrompts().filter(x => x.id !== id);
    write(PROMPTS_KEY, all);
    window.dispatchEvent(new CustomEvent(EVT));
}
export function onPromptsChange(cb: () => void) {
    const handler = () => cb();
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
}

// --- User templates (separate from prompts so you can curate both) ---
export type UserTemplate = { id: string; title: string; desc?: string; body: string; tags?: string[]; updatedAt: number };

export function listUserTemplates(): UserTemplate[] {
    return read<UserTemplate[]>(TEMPLATES_KEY, []).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function upsertUserTemplate(t: { id?: string; title: string; desc?: string; body: string; tags?: string[] }): UserTemplate {
    const now = Date.now();
    const all = listUserTemplates();
    let item: UserTemplate;
    if (t.id) {
        const idx = all.findIndex(x => x.id === t.id);
        if (idx >= 0) {
            all[idx] = { ...all[idx], ...t, updatedAt: now };
            item = all[idx];
        } else {
            item = { id: t.id, title: t.title, desc: t.desc, body: t.body, tags: t.tags, updatedAt: now };
            all.push(item);
        }
    } else {
        item = { id: crypto.randomUUID(), title: t.title, desc: t.desc, body: t.body, tags: t.tags || [], updatedAt: now };
        all.push(item);
    }
    write(TEMPLATES_KEY, all);
    window.dispatchEvent(new CustomEvent(TEVT));
    return item;
}
export function deleteUserTemplate(id: string) {
    const all = listUserTemplates().filter(x => x.id !== id);
    write(TEMPLATES_KEY, all);
    window.dispatchEvent(new CustomEvent(TEVT));
}
export function onTemplatesChange(cb: () => void) {
    const handler = () => cb();
    window.addEventListener(TEVT, handler);
    return () => window.removeEventListener(TEVT, handler);
}
