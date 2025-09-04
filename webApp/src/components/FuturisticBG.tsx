import { useEffect, useRef } from "react";

/**
 * Minimal, classy background:
 * - Pure black canvas
 * - Soft white radial glow
 * - "Code globe": masked circular area with scrolling ASCII characters
 * - Sparse twinkles around the globe
 *
 * Props:
 *   accent  : character/particle color (default white)
 *   bg      : background color (default black)
 *   intensity: 0..1 overall strength
 */
export default function FuturisticBG({
                                         accent = "#000000",
                                         bg = "#fffcf4",
                                         intensity = 0.85,
                                     }: {
    accent?: string;
    bg?: string;
    intensity?: number;
}) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current!;
        const ctx = canvas.getContext("2d", { alpha: true })!;
        let raf = 0;
        let running = true;

        const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.floor(rect.width * DPR);
            canvas.height = Math.floor(rect.height * DPR);
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        };
        resize();
        const onResize = () => resize();
        window.addEventListener("resize", onResize, { passive: true });

        // ------- CONFIG (tweak to taste) -------
        const charset = "01<>/|{}[]#*+=".split("");
        const globeRadiusRatio = 0.9; // radius relative to min(width,height)
        const colSpacing = 12;         // px between columns
        const rowSpacing = 14;         // px between rows (line height)
        const twinkleCount = 70;       // sparse and elegant
        // ---------------------------------------

        // Twinkles
        const twinkles = Array.from({ length: twinkleCount }, () => ({
            x: Math.random(),
            y: Math.random(),
            r: 0.6 + Math.random() * 1.1,
            p: Math.random() * Math.PI * 2,
            s: 0.6 + Math.random() * 1.2,
        }));

        // Precompute columns for the code-rain inside the globe
        const columns: {
            x: number;        // x position (px)
            speed: number;    // px/sec
            offset: number;   // initial scroll offset
            jitter: number;   // slight phase
        }[] = [];

        const rebuildColumns = () => {
            columns.length = 0;
            const w = canvas.width / DPR;
            const h = canvas.height / DPR;
            const r = Math.min(w, h) * globeRadiusRatio;
            const cx = w / 2;
// columns across the diameter of the globe
            for (let x = cx - r; x <= cx + r; x += colSpacing) {
                const speed = 28 + Math.random() * 22; // clean, not too fast
                columns.push({ x, speed, offset: Math.random() * 1000, jitter: Math.random() * 2 });
            }
        };
        rebuildColumns();

        const draw = (ts: number) => {
            if (!running) return;
            const t = ts * 0.001;
            const w = canvas.width / DPR;
            const h = canvas.height / DPR;
            const cx = w / 2;
            const cy = h / 2;
            const r = Math.min(w, h) * globeRadiusRatio;

            // BACKGROUND
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            // Soft spotlight glow behind globe
            const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.5);
            glow.addColorStop(0, `rgba(255,255,255,${0.07 * intensity})`);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);

            // TWINKLES (very subtle)
            for (const s of twinkles) {
                const x = s.x * w;
                const y = s.y * h;
                const pulse = 0.5 + 0.5 * Math.sin(t * s.s + s.p);
                ctx.beginPath();
                ctx.arc(x, y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${0.18 * pulse * intensity})`;
                ctx.fill();
            }

            // CODE GLOBE
            // clip to a circle, draw vertical "code rain" columns with edge falloff
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();

            // faint inner glow
            const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            inner.addColorStop(0, `rgba(255,255,255,${0.10 * intensity})`);
            inner.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = inner;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillStyle = accent;

            for (const col of columns) {
                // compute column vertical scroll
                const yScroll = (t * col.speed + col.offset) % rowSpacing;

                // draw characters down the full canvas height, but only those that fall inside the circle show (due to clip)
                for (let y = -rowSpacing; y < h + rowSpacing; y += rowSpacing) {
                    const yy = y + yScroll;

                    // radial falloff to shape the sphere (characters get dimmer near edges)
                    const dx = col.x - cx;
                    const dy = yy - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > r) continue;

                    const edge = dist / r;                // 0 center -> 1 edge
                    let alpha = 0.85 - edge * 0.85;       // stronger center, fade to edge
                    alpha = Math.max(0, Math.min(alpha, 1)) * (0.75 * intensity);

                    if (alpha < 0.04) continue;

                    // choose a character, add gentle horizontal sine jitter
                    const ch = charset[((Math.floor((yy + col.jitter * 37) / rowSpacing) % charset.length) + charset.length) % charset.length];
                    const jitterX = Math.sin((yy + t * 120 + col.jitter * 100) * 0.01) * 1.2;

                    ctx.globalAlpha = alpha;
                    ctx.fillText(ch, col.x + jitterX, yy);
                }
            }
            ctx.restore();

            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);

        return () => {
            running = false;
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [accent, bg, intensity]);

    return (
        <canvas
            ref={ref}
            style={{
                position: "fixed",
                inset: 0,
                width: "100%",
                height: "100%",
                zIndex: 0,
                pointerEvents: "none",
                // no extra filters; keep it crisp and clean
            }}
        />
    );
}
