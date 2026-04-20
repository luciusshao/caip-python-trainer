"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";

// ─── Web Audio: synthesize a "click" sound ───────────────────────
function playClickSound() {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();

  // Layer 1 — short noise burst (mechanical snap)
  const bufLen = Math.floor(ctx.sampleRate * 0.02);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 10);
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500;
  noiseSrc.connect(hp).connect(noiseGain).connect(ctx.destination);
  noiseSrc.start(ctx.currentTime);
  noiseSrc.stop(ctx.currentTime + 0.02);

  // Layer 2 — descending sine (metallic resonance)
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);

  setTimeout(() => ctx.close(), 200);
}

// ─── Main Page ───────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [isOn, setIsOn] = useState(false);
  const [shadeHue, setShadeHue] = useState(280);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Auth state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Derived colors
  const lampColor = useMemo(() => `hsl(${shadeHue}, 70%, 50%)`, [shadeHue]);
  const lampGlow = useMemo(
    () => `hsl(${shadeHue}, 70%, 50%, 0.35)`,
    [shadeHue],
  );
  const lampGlowStrong = useMemo(
    () => `hsl(${shadeHue}, 80%, 60%, 0.6)`,
    [shadeHue],
  );

  // ─── Toggle handler ────────────────────────────────────────────
  const toggleLamp = useCallback(() => {
    setIsOn((prev) => {
      const next = !prev;
      const newHue = next ? Math.floor(Math.random() * 360) : shadeHue;
      if (next) setShadeHue(newHue);

      const root = document.documentElement.style;
      root.setProperty("--lamp-on", next ? "1" : "0");
      root.setProperty("--shade-hue", String(next ? newHue : shadeHue));
      root.setProperty(
        "--lamp-color",
        `hsl(${next ? newHue : shadeHue}, 70%, 50%)`,
      );
      root.setProperty(
        "--lamp-glow",
        `hsl(${next ? newHue : shadeHue}, 70%, 50%, 0.3)`,
      );

      playClickSound();
      return next;
    });
  }, [shadeHue]);

  // Clean up CSS vars on unmount
  useEffect(() => {
    return () => {
      const root = document.documentElement.style;
      root.removeProperty("--lamp-on");
      root.removeProperty("--shade-hue");
      root.removeProperty("--lamp-color");
      root.removeProperty("--lamp-glow");
    };
  }, []);

  // ─── Drag handlers ─────────────────────────────────────────────
  const handleDrag = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragOffset(Math.max(0, info.offset.y));
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 50) {
        toggleLamp();
      }
      setDragOffset(0);
    },
    [toggleLamp],
  );

  // ─── SVG layout constants ─────────────────────────────────────
  const CORD_START_X = 78;
  const CORD_START_Y = 130;
  const CORD_END_Y = 185;

  // Dynamic cord path reacting to drag
  const cordPath = useMemo(() => {
    const sx = CORD_START_X;
    const sy = CORD_START_Y;
    const ey = CORD_END_Y + dragOffset;
    const cx = sx + Math.min(dragOffset * 0.15, 8);
    const cy = (sy + ey) / 2;
    return `M ${sx} ${sy} Q ${cx} ${cy} ${sx} ${ey}`;
  }, [dragOffset]);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-dark">
      {/* Background decorative gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,7,100,0.55) 0%, transparent 100%)",
        }}
      />

      {/* Ambient light glow — between lamp and form, biased right */}
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: 700,
          height: 500,
          top: "15%",
          left: "45%",
          x: "-50%",
          borderRadius: "50%",
        }}
        animate={{
          opacity: isOn ? 0.4 : 0,
          background: isOn
            ? `radial-gradient(ellipse 70% 50% at 30% 40%, ${lampGlowStrong} 0%, transparent 70%)`
            : "none",
        }}
        transition={{ duration: 0.6 }}
      />

      {/* ── Main content: side-by-side layout ─────────────────── */}
      <div className="relative z-10 flex w-full max-w-[960px] flex-col items-center gap-8 px-6 md:flex-row md:items-start md:justify-center md:gap-16 lg:gap-24">

        {/* ── LEFT: Lamp + hint ────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <svg
            viewBox="0 0 200 280"
            className="w-[220px] select-none md:w-[280px] lg:w-[320px]"
            style={{ overflow: "visible" }}
          >
            <defs>
              <linearGradient id="lightGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor={lampColor} stopOpacity={0.55} />
                <stop offset="100%" stopColor={lampColor} stopOpacity={0} />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="handleGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Light Cone — shines right toward the form */}
            <motion.path
              d="M 90 115 L 200 60 L 200 275 Z"
              fill="url(#lightGrad)"
              animate={{
                opacity: isOn ? 1 : 0,
                scaleX: isOn ? 1 : 0.2,
              }}
              style={{ transformOrigin: "90px 115px" }}
              transition={{ type: "spring", stiffness: 100, damping: 16 }}
            />

            {/* Base shadow */}
            <ellipse cx={100} cy={266} rx={48} ry={5} fill="rgba(0,0,0,0.4)" />

            {/* Base */}
            <rect
              x={60} y={248} width={80} height={16} rx={5}
              fill="#3B0764" stroke="#6B21A8" strokeWidth={1.5}
            />
            <rect x={64} y={249} width={72} height={2} rx={1} fill="rgba(107,33,168,0.4)" />

            {/* Lower Neck */}
            <rect x={96} y={188} width={8} height={60} rx={3} fill="#6B21A8" />
            <rect x={97} y={190} width={2} height={56} rx={1} fill="rgba(162,28,175,0.3)" />

            {/* Joint */}
            <circle cx={100} cy={188} r={7} fill="#A21CAF" />
            <circle cx={100} cy={188} r={3.5} fill="#6B21A8" />

            {/* Upper Neck (angled) */}
            <line x1={100} y1={188} x2={78} y2={120} stroke="#6B21A8" strokeWidth={8} strokeLinecap="round" />
            <line x1={99} y1={186} x2={77.5} y2={121} stroke="rgba(162,28,175,0.25)" strokeWidth={2} strokeLinecap="round" />

            {/* Shade (trapezoid) */}
            <motion.path
              d="M 50 120 L 45 98 L 111 98 L 106 120 Z"
              animate={{
                fill: isOn ? lampColor : "#1e1b4b",
                stroke: isOn ? lampColor : "#4c1d95",
              }}
              strokeWidth={1.5} strokeLinejoin="round"
              transition={{ duration: 0.35 }}
            />
            <motion.path
              d="M 54 118 L 50 102 L 106 102 L 102 118 Z"
              fill="none"
              animate={{
                stroke: isOn ? `hsl(${shadeHue}, 80%, 70%)` : "rgba(75, 29, 149, 0.3)",
              }}
              strokeWidth={0.8}
              transition={{ duration: 0.35 }}
            />
            <line x1={49} y1={120} x2={107} y2={120} stroke="#F5A623" strokeWidth={2} opacity={0.6} />

            {/* Eyes */}
            <motion.g
              animate={{ rotate: isOn ? 0 : 180 }}
              style={{ transformOrigin: "78px 109px" }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
            >
              {/* Left eye */}
              <circle cx={67} cy={109} r={7} fill="white" />
              <motion.circle
                r={3}
                animate={{
                  cx: isOn ? 70 : 67,
                  cy: isOn ? 108 : 106,
                  fill: isOn ? "#0F172A" : "#374151",
                }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
              />
              {/* Right eye */}
              <circle cx={89} cy={109} r={7} fill="white" />
              <motion.circle
                r={3}
                animate={{
                  cx: isOn ? 92 : 89,
                  cy: isOn ? 108 : 106,
                  fill: isOn ? "#0F172A" : "#374151",
                }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
              />
            </motion.g>

            {/* Bulb */}
            <motion.circle
              cx={78} cy={124} r={6}
              animate={{ fill: isOn ? `hsl(${shadeHue}, 85%, 78%)` : "#2d2250", opacity: isOn ? 1 : 0.3 }}
              filter={isOn ? "url(#glow)" : undefined}
              transition={{ duration: 0.3 }}
            />
            <motion.circle
              cx={76} cy={122} r={2}
              animate={{ fill: isOn ? "rgba(255,255,255,0.6)" : "transparent" }}
              transition={{ duration: 0.3 }}
            />

            {/* Pull Cord */}
            <motion.path
              d={cordPath} stroke="#F5A623" strokeWidth={2} fill="none" strokeLinecap="round"
              animate={{ d: cordPath }}
              transition={{ type: "spring", stiffness: 350, damping: 12 }}
            />
            <motion.circle
              cx={CORD_START_X} cy={CORD_END_Y - 7 + dragOffset} r={2}
              fill="#F5A623" opacity={0.8}
              animate={{ cy: CORD_END_Y - 7 + dragOffset }}
              transition={{ type: "spring", stiffness: 350, damping: 12 }}
            />

            {/* Cord Handle (draggable) */}
            <motion.circle
              cx={CORD_START_X} cy={CORD_END_Y} r={18}
              fill="transparent"
              style={{ cursor: "grab", touchAction: "none" }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 80 }}
              dragElastic={0.1}
              dragMomentum={false}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              onClick={toggleLamp}
              data-testid="cord-handle"
            />
            <motion.circle
              cx={CORD_START_X} cy={CORD_END_Y + dragOffset} r={6}
              fill="#F5A623" stroke="#FCD34D" strokeWidth={2}
              style={{ pointerEvents: "none" }}
              filter={!isOn ? "url(#handleGlow)" : undefined}
              animate={{ cy: CORD_END_Y + dragOffset, scale: dragOffset > 0 ? 1.3 : 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 12 }}
            />
            {/* Pulsing ring hint */}
            {!isOn && (
              <motion.circle
                cx={CORD_START_X} cy={CORD_END_Y} r={10}
                fill="none" stroke="#F5A623" strokeWidth={1}
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 2.2 }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
              />
            )}
          </svg>

        </div>

        {/* ── RIGHT: Login Form ────────────────────────────────── */}
        <motion.div
          className="w-[380px] max-w-[90vw] rounded-2xl px-8 py-8 backdrop-blur-xl"
          animate={{
            opacity: isOn ? 1 : 0,
            scale: isOn ? 1 : 0.85,
            x: isOn ? 0 : 40,
          }}
          transition={{
            type: "spring",
            stiffness: 120,
            damping: 18,
            mass: 0.8,
          }}
          style={{
            pointerEvents: isOn ? "auto" : "none",
            background: "rgba(59, 7, 100, 0.5)",
            border: `1.5px solid ${isOn ? lampColor : "transparent"}`,
            boxShadow: isOn
              ? `0 0 40px ${lampGlow}, 0 0 80px ${lampGlow}, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`
              : "none",
          }}
        >
          <h2 className="mb-6 text-center text-2xl font-bold text-brand-white">
            欢迎回来
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!username || !password || loginLoading) return;
              setLoginError("");
              setLoginLoading(true);
              try {
                const res = await fetch("/api/auth/student/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username, password }),
                });
                const data = await res.json();
                if (res.ok) {
                  router.push(data.mustChangePassword ? "/change-password" : "/");
                } else {
                  setLoginError(data.error || "登录失败");
                }
              } catch {
                setLoginError("网络错误，请重试");
              } finally {
                setLoginLoading(false);
              }
            }}
          >
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            账号
          </label>
          <motion.input
            type="text"
            placeholder="请输入账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
            onFocus={() => setFocusedField("user")}
            onBlur={() => setFocusedField(null)}
            animate={{
              boxShadow:
                focusedField === "user" && isOn
                  ? `0 0 20px ${lampGlow}, 0 0 0 2px ${lampColor}`
                  : "0 0 0 0 transparent, 0 0 0 1px rgba(255,255,255,0.08)",
            }}
            transition={{ duration: 0.25 }}
          />

          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            密码
          </label>
          <div className="relative mb-6">
          <motion.input
            type={showPassword ? "text" : "password"}
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-white/5 px-4 py-2.5 pr-12 text-sm text-white placeholder-gray-500 outline-none"
            onFocus={() => setFocusedField("pass")}
            onBlur={() => setFocusedField(null)}
            animate={{
              boxShadow:
                focusedField === "pass" && isOn
                  ? `0 0 20px ${lampGlow}, 0 0 0 2px ${lampColor}`
                  : "0 0 0 0 transparent, 0 0 0 1px rgba(255,255,255,0.08)",
            }}
            transition={{ duration: 0.25 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
          </div>

          {loginError && (
            <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/30 p-2.5">
              <p className="text-xs text-red-400 text-center">{loginError}</p>
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loginLoading || !username || !password}
            className="w-full rounded-lg bg-gradient-to-r from-brand-gold to-brand-gold-light py-2.5 text-sm font-semibold text-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02, boxShadow: `0 0 24px ${lampGlow}` }}
            whileTap={{ scale: 0.97 }}
          >
            {loginLoading ? "登录中..." : "登录"}
          </motion.button>
          </form>

          <div className="mt-4 text-center">
            <a
              href="#"
              className="text-xs text-gray-400 transition-colors hover:text-brand-gold"
            >
              忘记密码？
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
