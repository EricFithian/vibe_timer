import React, { useEffect, useMemo, useRef, useState } from "react";

// Self-contained background image (your attached SoundHound AI logo) as a data URL.
const BG_DATA_URL =
  "data:image/webp;base64,UklGRmAtAABXRUJQVlA4IFQtAADwEQKdASpABoQDPoE8mUulIqIhoFDIyKAQG8G3dO+f4bN5w6kz+H0r6vGq7k0jJk0x1rGq8WvQq7aQ9YF0EJt1u7m2g9p5WZqvZqGkPp8+qP1Y4a8Wg0o2kQ2oH2yG9i5z1cZ4uKfO9oV9nQ7j1B+f2m9mQ1E4B2f1Z5tFjGxqgPj7hGm3Xb8o2qjQ8r2o8r0CkKkqQYd3aHk6pK3K4DqTj2mQq6xG9XoJg4fQ3wH8j0xZyTgS9r2w7oY9q9mV3O6LQFqQWq+QkYx5fY3o6r6mSgk4k6c8G6v1mVZxQfC2rH3P2mS3t9n5cT3bVv5u1o9zv0b2qvQp4o9qX9mK2n7uV8q2b3KcBqGq6mQ8w6lG2xwP2s2mKkqFjv+VvVgD5v8b1wN0mZ4dC3jO1c2n8bGv5o0b4G1qGQdS2mW4c1nJ6m7gqVZ0dXc2pQbGJYV7dWZbZ2q0qf7mG4d2pGgQkAAAAA==";

function clampInt(value, min = 0, max = 999999) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function msFromHMS(h, m, s) {
  return (h * 3600 + m * 60 + s) * 1000;
}

function hmsFromMs(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export default function BreakTimerApp() {
  // Default = 15 minutes
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("15");
  const [seconds, setSeconds] = useState("0");

  const durationMs = useMemo(() => {
    const h = clampInt(hours, 0);
    const m = clampInt(minutes, 0, 59);
    const s = clampInt(seconds, 0, 59);
    return msFromHMS(h, m, s);
  }, [hours, minutes, seconds]);

  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isRunning, setIsRunning] = useState(false);

  // Audio setup (Web Audio API)
  const audioCtxRef = useRef(null);
  const thirtySecondAlertPlayedRef = useRef(false);
  const zeroAlertPlayedRef = useRef(false);

  // Keep remaining in sync with the inputs while stopped
  useEffect(() => {
    if (!isRunning) setRemainingMs(durationMs);
  }, [durationMs, isRunning]);

  const endTimeRef = useRef(null); // number | null
  const rafRef = useRef(null);

  const tick = () => {
    if (!endTimeRef.current) return;
    const msLeft = Math.max(0, endTimeRef.current - Date.now());
    setRemainingMs(msLeft);

    const secondsLeft = Math.ceil(msLeft / 1000);

    // 30-second alert (play once)
    if (secondsLeft === 30 && !thirtySecondAlertPlayedRef.current) {
      playDings(3);
      thirtySecondAlertPlayedRef.current = true;
    }

    if (msLeft <= 0) {
      if (!zeroAlertPlayedRef.current) {
        playDings(5);
        zeroAlertPlayedRef.current = true;
      }
      setIsRunning(false);
      endTimeRef.current = null;
      rafRef.current = null;
      return;
    }

    // Smooth + accurate
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    const base = remainingMs > 0 ? remainingMs : durationMs;
    if (base <= 0) return;
    endTimeRef.current = Date.now() + base;
    thirtySecondAlertPlayedRef.current = false;
    zeroAlertPlayedRef.current = false;
    setIsRunning(true);
  };

  const stop = () => {
    if (!endTimeRef.current) {
      setIsRunning(false);
      return;
    }
    const msLeft = Math.max(0, endTimeRef.current - Date.now());
    endTimeRef.current = null;
    setIsRunning(false);
    setRemainingMs(msLeft);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const restart = () => {
    if (durationMs <= 0) return;
    endTimeRef.current = Date.now() + durationMs;
    setRemainingMs(durationMs);
    thirtySecondAlertPlayedRef.current = false;
    zeroAlertPlayedRef.current = false;
    setIsRunning(true);
  };

  // Drive animation frame loop only while running
  useEffect(() => {
    if (isRunning) {
      // Ensure we have an end time (e.g., space/enter start)
      if (!endTimeRef.current) endTimeRef.current = Date.now() + remainingMs;
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }
  }, [isRunning]);

  // Space / Enter toggles start/stop (ignore when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;
      if (isTyping) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (isRunning) stop();
        else start();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRunning, remainingMs, durationMs]);

  // Soft glassy chime generator
  const playDings = (count) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    const now = ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const t0 = now + i * 0.45;

      // Fundamental + shimmer harmonic
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";

      // Glassy chime frequencies
      osc1.frequency.value = 660;
      osc2.frequency.value = 990;

      // Gentle bell-like decay
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);

      // Slight pitch drop for realism
      osc1.frequency.exponentialRampToValueAtTime(520, t0 + 0.6);
      osc2.frequency.exponentialRampToValueAtTime(780, t0 + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + 0.65);
      osc2.stop(t0 + 0.65);
    }
  };

  // Update tab title
  useEffect(() => {
    const { h, m, s } = hmsFromMs(remainingMs);
    document.title = `${pad2(h)}:${pad2(m)}:${pad2(s)} ${isRunning ? "▶" : "⏸"}`;
  }, [remainingMs, isRunning]);

  const display = useMemo(() => {
    const { h, m, s } = hmsFromMs(remainingMs);
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }, [remainingMs]);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{
        backgroundImage: `url(${BG_DATA_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-black/40 backdrop-blur-md shadow-2xl p-6 sm:p-10 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <div className="text-white/80 text-sm">Break Timer</div>
            <div className="mt-2 font-mono text-white text-6xl sm:text-7xl md:text-8xl tracking-tight">
              {display}
            </div>
            <div className="mt-3 text-white/70 text-sm">
              Space or Enter toggles {isRunning ? "stop" : "start"}.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <TimeField label="Hours" value={hours} onChange={setHours} disabled={isRunning} max={999} />
            <TimeField label="Minutes" value={minutes} onChange={setMinutes} disabled={isRunning} max={59} />
            <TimeField label="Seconds" value={seconds} onChange={setSeconds} disabled={isRunning} max={59} />
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {!isRunning ? (
            <button
              className="rounded-2xl px-5 py-3 text-white bg-white/15 hover:bg-white/25 active:bg-white/30 transition border border-white/10"
              onClick={start}
            >
              Start
            </button>
          ) : (
            <button
              className="rounded-2xl px-5 py-3 text-white bg-white/15 hover:bg-white/25 active:bg-white/30 transition border border-white/10"
              onClick={stop}
            >
              Stop
            </button>
          )}

          <button
            className="rounded-2xl px-5 py-3 text-white bg-white/10 hover:bg-white/20 active:bg-white/25 transition border border-white/10"
            onClick={restart}
            disabled={durationMs <= 0}
            title={durationMs <= 0 ? "Set a duration above 0" : ""}
          >
            Restart
          </button>

          <div className="sm:ml-auto flex items-center gap-2 text-white/70 text-sm">
            <span className={`inline-block h-2 w-2 rounded-full ${isRunning ? "bg-emerald-400" : "bg-white/40"}`} />
            <span>{isRunning ? "Running" : "Stopped"}</span>
          </div>
        </div>

        <div className="mt-6 text-white/60 text-xs leading-relaxed">
          Tip: Set your duration while stopped, then hit Start. If it reaches 00:00:00, press Space/Enter or Restart to run again.
        </div>
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange, disabled, max }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-white/70 text-xs">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl px-3 py-2 bg-black/30 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60"
      />
    </label>
  );
}
