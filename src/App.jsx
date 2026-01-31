import React, { useEffect, useRef, useState } from "react";

/** Lightweight fireworks overlay (canvas), no libraries */
function Fireworks({ active, durationMs = 6000 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const lastBurstRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const colors = [
      "#ff4d6d",
      "#ffd166",
      "#06d6a0",
      "#4cc9f0",
      "#a78bfa",
      "#f472b6",
      "#fb7185",
    ];

    const spawnBurst = (x, y) => {
      const count = 90;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.012 + Math.random() * 0.018,
          r: 1.2 + Math.random() * 1.8,
          color: colors[(Math.random() * colors.length) | 0],
        });
      }
    };

    const step = (t) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = "lighter";

      // bursts every ~260ms while active
      if (t - lastBurstRef.current > 260 && elapsed < durationMs) {
        lastBurstRef.current = t;
        const x = 80 + Math.random() * (window.innerWidth - 160);
        const y = 80 + Math.random() * (window.innerHeight * 0.55);
        spawnBurst(x, y);
      }

      // update + draw particles
      const gravity = 0.06;
      const next = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.life -= p.decay;

        if (p.life > 0) {
          next.push(p);
          ctx.beginPath();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
          ctx.fillStyle = p.color;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      particlesRef.current = next;

      ctx.globalAlpha = 1;

      if (elapsed < durationMs || particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
      lastBurstRef.current = 0;
      startRef.current = 0;
    };
  }, [active, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}

export default function App() {
  const [accepted, setAccepted] = useState(false);

  // “No” runs away in this playground area
  const playRef = useRef(null);
  const noRef = useRef(null);

  const [noPos, setNoPos] = useState({ x: 220, y: 40 });
  const [noScale, setNoScale] = useState(1);
  const [yesScale, setYesScale] = useState(1);

  const lastMoveRef = useRef(0);
  const lastCursorRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // place "No" nicely on first render (right side)
    const placeInitial = () => {
      const area = playRef.current?.getBoundingClientRect();
      const btn = noRef.current?.getBoundingClientRect();
      if (!area || !btn) return;
      const x = Math.max(0, area.width - btn.width - 24);
      const y = Math.max(0, (area.height - btn.height) / 2);
      setNoPos({ x, y });
    };
    placeInitial();
    window.addEventListener("resize", placeInitial);
    return () => window.removeEventListener("resize", placeInitial);
  }, []);

  const moveNoSomewhereElse = () => {
    const area = playRef.current?.getBoundingClientRect();
    const btn = noRef.current?.getBoundingClientRect();
    if (!area || !btn) return;

    const maxX = Math.max(0, area.width - btn.width);
    const maxY = Math.max(0, area.height - btn.height);

    // try a few random spots; prefer far from cursor
    const { x: cx, y: cy } = lastCursorRef.current;
    let best = { x: Math.random() * maxX, y: Math.random() * maxY };
    let bestDist = -1;

    for (let i = 0; i < 12; i++) {
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }

    setNoPos(best);

    // shrink "No", grow "Yes"
    setNoScale((s) => Math.max(0.35, s * 0.92));
    setYesScale((s) => Math.min(1.9, s * 1.06));
  };

  const handleMouseMove = (e) => {
    if (accepted) return;
    const area = playRef.current?.getBoundingClientRect();
    const noBtn = noRef.current?.getBoundingClientRect();
    if (!area || !noBtn) return;

    const cursorX = e.clientX - area.left;
    const cursorY = e.clientY - area.top;
    lastCursorRef.current = { x: cursorX, y: cursorY };

    const noCenterX = (noBtn.left + noBtn.right) / 2 - area.left;
    const noCenterY = (noBtn.top + noBtn.bottom) / 2 - area.top;

    const dist = Math.hypot(cursorX - noCenterX, cursorY - noCenterY);

    // throttle so it feels smooth, not chaotic
    const now = performance.now();
    const threshold = 120 * Math.max(0.6, noScale); // closer when "No" is tiny
    if (dist < threshold && now - lastMoveRef.current > 70) {
      lastMoveRef.current = now;
      moveNoSomewhereElse();
    }
  };

  const pagePadding = "clamp(12px, 4vw, 24px)";

  return (
    <div
      style={{
        minHeight: "100svh",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        display: "grid",
        placeItems: "center",
        // daffodil yellow gradient
        background:
          "radial-gradient(1200px 600px at 50% 0%, #fff9c4 0%, #ffe066 40%, #ffd60a 100%)",
        // safe-area friendly padding
        padding: `calc(${pagePadding} + env(safe-area-inset-top)) calc(${pagePadding} + env(safe-area-inset-right)) calc(${pagePadding} + env(safe-area-inset-bottom)) calc(${pagePadding} + env(safe-area-inset-left))`,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
      }}
    >
      <Fireworks active={accepted} />

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          boxSizing: "border-box",
          marginInline: "auto",

          background: "rgba(255,255,255,0.85)",
          borderRadius: "clamp(16px, 4vw, 20px)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
          padding: "clamp(18px, 4.5vw, 28px)",
          border: "1px solid rgba(255,255,255,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* simple cute icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div
            style={{
              width: "clamp(64px, 18vw, 84px)",
              height: "clamp(64px, 18vw, 84px)",
              borderRadius: "50%",
              background: "#f6c08f",
              position: "relative",
              boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
              flex: "0 0 auto",
            }}
          >
            {/* ears */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                width: 18,
                height: 18,
                background: "#f6c08f",
                transform: "rotate(18deg)",
                borderRadius: "4px 14px 4px 14px",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 18,
                height: 18,
                background: "#f6c08f",
                transform: "rotate(-18deg)",
                borderRadius: "14px 4px 14px 4px",
              }}
            />
            {/* eyes */}
            <div
              style={{
                position: "absolute",
                top: 34,
                left: 26,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#111",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 34,
                right: 26,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#111",
              }}
            />
            {/* nose */}
            <div
              style={{
                position: "absolute",
                top: 46,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "10px solid #f472b6",
              }}
            />
            {/* heart */}
            <div style={{ position: "absolute", top: 6, right: -2, fontSize: 22 }}>
              💖
            </div>
          </div>
        </div>

        <h1
          style={{
            textAlign: "center",
            fontSize: "clamp(20px, 6vw, 28px)",
            lineHeight: 1.2,
            margin: 0,
            fontWeight: 800,
            color: "#111827",
            paddingInline: 6,
            wordBreak: "break-word",
          }}
        >
          Tariro will you be my valentine?
        </h1>

        <p
          style={{
            textAlign: "center",
            marginTop: 10,
            marginBottom: 18,
            color: "rgba(17,24,39,0.75)",
            fontSize: "clamp(14px, 3.8vw, 16px)",
          }}
        >
          {accepted ? "YAAAY!!! 🎉💞" : "Choose wisely 😄"}
        </p>

        {/* button playground */}
        <div
          ref={playRef}
          onMouseMove={handleMouseMove}
          style={{
            position: "relative",
            height: "clamp(140px, 26vh, 170px)",
            borderRadius: "clamp(14px, 3.5vw, 16px)",
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* YES (center-ish) */}
          <button
            onClick={() => setAccepted(true)}
            disabled={accepted}
            style={{
              transform: `scale(${yesScale})`,
              transition: "transform 120ms ease",
              background: "#fb7185",
              color: "white",
              border: "none",
              padding: "clamp(12px, 3.4vw, 14px) clamp(18px, 5vw, 24px)",
              borderRadius: 999,
              fontWeight: 800,
              cursor: accepted ? "default" : "pointer",
              boxShadow: "0 10px 24px rgba(251,113,133,0.35)",
              zIndex: 2,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              fontSize: "clamp(14px, 4vw, 16px)",
            }}
          >
            Yes
          </button>

          {/* NO (runs away) */}
          {!accepted && (
            <button
              ref={noRef}
              onMouseEnter={moveNoSomewhereElse}
              onFocus={moveNoSomewhereElse}
              style={{
                position: "absolute",
                left: noPos.x,
                top: noPos.y,
                transform: `scale(${noScale})`,
                transformOrigin: "center",
                transition: "left 90ms ease, top 90ms ease, transform 120ms ease",
                background: "transparent",
                color: "#111827",
                border: "1px solid rgba(17,24,39,0.25)",
                padding: "clamp(10px, 3vw, 12px) clamp(16px, 4.4vw, 20px)",
                borderRadius: 999,
                fontWeight: 800,
                cursor: "pointer",
                zIndex: 3,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                fontSize: "clamp(14px, 4vw, 16px)",
              }}
            >
              No
            </button>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: "clamp(11px, 3.2vw, 12px)",
            color: "rgba(17,24,39,0.55)",
          }}
        >
          “ Don't Say Noo 😈
        </div>
      </div>
    </div>
  );
}
