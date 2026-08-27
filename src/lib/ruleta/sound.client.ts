"use client";

// Synthesized sound effects for La Ruleta en línea — built with the Web
// Audio API so there are no audio asset files to ship/host. Every function
// is wrapped in try/catch so a browser without Web Audio (or one that
// blocks autoplay before any user gesture) just silently plays nothing.

interface Note {
  freq: number;
  start: number; // seconds from now
  duration: number; // seconds
  gain?: number;
  type?: OscillatorType;
}

function playNotes(notes: Note[]) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    let maxEnd = 0;

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
      maxEnd = Math.max(maxEnd, start + duration + 0.05);
    });

    setTimeout(() => ctx.close(), (maxEnd + 0.2) * 1000);
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
