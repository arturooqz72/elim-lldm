"use client";

// Synthesized sound effects for La Ruleta en línea — built with the Web
// Audio API so there are no audio asset files to ship/host. Every function
// is wrapped in try/catch so a browser without Web Audio just silently
// plays nothing.
//
// The AudioContext is a shared singleton, not one-per-sound: mobile
// browsers create it in a "suspended" state until the user has interacted
// with the page at least once, and it must be explicitly resumed from
// inside that gesture's call stack — creating (and closing) a fresh
// context per sound effect never gets past "suspended", so nothing was
// audible for events that fire from a realtime broadcast handler rather
// than a direct click (e.g. another player's turn resolving).

interface Note {
  freq: number;
  start: number; // seconds from now
  duration: number; // seconds
  gain?: number;
  type?: OscillatorType;
}

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (sharedCtx) return sharedCtx;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AudioCtx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Call this from inside a real click/tap handler (e.g. joining the room,
 * spinning, guessing) so the shared AudioContext gets permission to play.
 * Safe to call repeatedly — resuming an already-running context is a no-op.
 */
export function unlockAudioContext() {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function playNotes(notes: Note[]) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    notes.forEach(({ freq, start, duration, gain = 0.16, type = "sine" }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, now + start);
      gainNode.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    });
  } catch {
    // Web Audio no disponible en este navegador
  }
}

/** "A player joined the lobby" — two-note ascending chime. */
export function playJoinChime() {
  playNotes([
    { freq: 880, start: 0, duration: 0.35 },
    { freq: 1174.66, start: 0.09, duration: 0.35 },
  ]);
}

/** The wheel just landed on a value/outcome — a short, neutral "clunk". */
export function playLandSound() {
  playNotes([{ freq: 220, start: 0, duration: 0.15, gain: 0.14, type: "triangle" }]);
}

/** A correct letter guess or a correct resolve-panel attempt. */
export function playCorrectSound() {
  playNotes([
    { freq: 659.25, start: 0, duration: 0.18, gain: 0.16 },
    { freq: 987.77, start: 0.08, duration: 0.25, gain: 0.18 },
  ]);
}

/** A wrong letter guess or a wrong resolve-panel attempt. */
export function playWrongSound() {
  playNotes([{ freq: 174.61, start: 0, duration: 0.3, gain: 0.15, type: "sawtooth" }]);
}

/** The round (or match) was won. */
export function playWinSound() {
  playNotes([
    { freq: 523.25, start: 0, duration: 0.2, gain: 0.16 },
    { freq: 659.25, start: 0.12, duration: 0.2, gain: 0.16 },
    { freq: 783.99, start: 0.24, duration: 0.35, gain: 0.2 },
  ]);
}

/** Landed on "bancarrota" — loses all points. */
export function playBankruptSound() {
  playNotes([
    { freq: 196, start: 0, duration: 0.25, gain: 0.18, type: "sawtooth" },
    { freq: 130.81, start: 0.15, duration: 0.4, gain: 0.18, type: "sawtooth" },
  ]);
}

/** The turn timer ran out. */
export function playTimeoutSound() {
  playNotes([
    { freq: 392, start: 0, duration: 0.12, gain: 0.15, type: "square" },
    { freq: 392, start: 0.16, duration: 0.12, gain: 0.15, type: "square" },
  ]);
}
