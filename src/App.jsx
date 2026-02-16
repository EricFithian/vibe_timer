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

export default function App() {
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
  const [showSettings, setShowSettings] = useState(false);

  // Keep remaining in sync with the inputs while stopped
  useEffect(() => {
    if (!isRunning) setRemainingMs(durationMs);
  }, [durationMs, isRunning]);

  const endTimeRef = useRef(null); // number | null
  const rafRef = useRef(null);

  // Audio setup (Web Audio API)
  const audioCtxRef = useRef(null);
  const thirtySecondAlertPlayedRef = useRef(false);
  const zeroAlertPlayedRef = useRef(false);

  // Soft glassy chime generator
  const playDings = (count) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const t0 = now + i * 0.45;

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
      if (!endTimeRef.current) endTimeRef.current = Date.now() + remainingMs;
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Space / Enter toggles start/stop (ignore when typing OR settings modal open)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        document.activeElement?.isContentEditable ||
        showSettings;

      if (isTyping) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (isRunning) stop();
        else start();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRunning, showSettings, remainingMs, durationMs]);

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
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative w-full max-w-5xl">
        <div className="rounded-[2.25rem] bg-black/35 backdrop-blur-md shadow-2xl border border-white/10 px-6 py-10 sm:px-10 sm:py-14">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="text-white/80 tracking-wide text-sm">BREAK</div>

            <div className="font-mono text-white text-7xl sm:text-8xl md:text-9xl leading-none tracking-tight">
              {display}
            </div>

            <div className="text-white/65 text-sm">
              Press <span className="text-white">Space</span> or{" "}
              <span className="text-white">Enter</span> to
              {isRunning ? " pause" : " start"}.
            </div>

            <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {!isRunning ? (
                <button
                  className="rounded-3xl px-6 py-6 text-white text-xl font-semibold bg-white/22 hover:bg-white/30 active:bg-white/35 transition border border-white/10 shadow-lg"
                  onClick={start}
                >
                  Start
                </button>
              ) : (
                <button
                  className="rounded-3xl px-6 py-6 text-white text-xl font-semibold bg-white/22 hover:bg-white/30 active:bg-white/35 transition border border-white/10 shadow-lg"
                  onClick={stop}
                >
                  Pause
                </button>
              )}

              <button
                className="rounded-3xl px-6 py-6 text-white text-xl font-semibold bg-white/12 hover:bg-white/20 active:bg-white/26 transition border border-white/10"
                onClick={restart}
                disabled={durationMs <= 0}
                title={durationMs <= 0 ? "Set a duration above 0" : ""}
              >
                Restart
              </button>

              <button
                className="rounded-3xl px-6 py-6 text-white text-xl font-semibold bg-white/10 hover:bg-white/18 active:bg-white/24 transition border border-white/10"
                onClick={() => setShowSettings(true)}
              >
                Set time
              </button>
            </div>

            <div className="mt-3 text-white/45 text-xs">
              Alerts: 3 chimes at 00:30 • 5 chimes at 00:00
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-white/45 text-xs">
          {isRunning ? "Running" : "Paused"} • Great as a dedicated break tab
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isRunning={isRunning}
        hours={hours}
        minutes={minutes}
        seconds={seconds}
        setHours={setHours}
        setMinutes={setMinutes}
        setSeconds={setSeconds}
        onClear={() => {
          stop();
          setRemainingMs(durationMs);
          thirtySecondAlertPlayedRef.current = false;
          zeroAlertPlayedRef.current = false;
        }}
        onPreset={(h, m, s) => {
          if (isRunning) return;
          setHours(String(h));
          setMinutes(String(m));
          setSeconds(String(s));
        }}
      />
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
  isRunning,
  hours,
  minutes,
  seconds,
  setHours,
  setMinutes,
  setSeconds,
  onClear,
  onPreset,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        className="absolute inset-0 bg-black/70"
        aria-label="Close settings"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl rounded-[2rem] bg-neutral-950/85 backdrop-blur-md border border-white/10 shadow-2xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-white text-xl font-semibold">Set time</div>
            <div className="mt-1 text-white/60 text-sm">
              {isRunning ? "Pause the timer to edit." : "Edit HH:MM:SS, or pick a preset."}
            </div>
          </div>
          <button
            className="rounded-2xl px-3 py-2 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 transition border border-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <TimeField label="Hours" value={hours} onChange={setHours} disabled={isRunning} max={999} />
          <TimeField label="Minutes" value={minutes} onChange={setMinutes} disabled={isRunning} max={59} />
          <TimeField label="Seconds" value={seconds} onChange={setSeconds} disabled={isRunning} max={59} />
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PresetButton disabled={isRunning} onClick={() => onPreset(0, 5, 0)} label="5 min" />
          <PresetButton disabled={isRunning} onClick={() => onPreset(0, 10, 0)} label="10 min" />
          <PresetButton disabled={isRunning} onClick={() => onPreset(0, 15, 0)} label="15 min" />
          <PresetButton disabled={isRunning} onClick={() => onPreset(0, 20, 0)} label="20 min" />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button
            className="rounded-2xl px-4 py-3 text-white bg-white/10 hover:bg-white/18 active:bg-white/22 transition border border-white/10"
            onClick={onClear}
          >
            Clear to set time
          </button>
          <div className="sm:ml-auto text-white/45 text-xs self-center">Press Esc to close</div>
        </div>
      </div>
    </div>
  );
}

function PresetButton({ label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl px-3 py-3 text-white/90 bg-white/7 hover:bg-white/12 active:bg-white/16 transition border border-white/10 disabled:opacity-50"
    >
      {label}
    </button>
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
