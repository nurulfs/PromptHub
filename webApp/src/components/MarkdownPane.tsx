import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownPane({ markdown }: { markdown: string }) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [userPinnedUp, setUserPinnedUp] = useState(false);

    // if the user is at the bottom (or close), keep auto-scrolling; otherwise don't
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        if (!userPinnedUp && nearBottom) {
            // scroll to bottom on new chunks
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
    }, [markdown, userPinnedUp]);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const onScroll = () => {
            const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
            // if user scrolls up, stop pinning; if they go back to bottom, re-pin
            setUserPinnedUp(!nearBottom);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    function handleCopy() {
        navigator.clipboard.writeText(markdown || "");
    }

    return (
        <div style={{ position: "relative" }}>
            {/* copy button */}
            <button onClick={handleCopy} style={copyBtnStyle} title="Copy">
                Copy
            </button>

            {/* scroll container */}
            <div ref={scrollerRef} style={containerStyle}>
                <article style={mdStyle}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ""}</ReactMarkdown>
                </article>
            </div>
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    width: "100%",
    maxHeight: 400,
    minHeight: 160,
    overflow: "auto",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fafafa",
    padding: 14,
};

const mdStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#111",
};

const copyBtnStyle: React.CSSProperties = {
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 1,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
};
