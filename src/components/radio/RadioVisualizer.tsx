"use client";

const HEIGHTS = [35, 55, 70, 45, 80, 60, 40, 75, 50, 65, 38, 82, 48, 72, 42, 68, 55, 44, 78, 52];
const DELAYS = [0, 0.1, 0.2, 0.05, 0.15, 0.25, 0.08, 0.18, 0.28, 0.03, 0.13, 0.23, 0.07, 0.17, 0.27, 0.12, 0.22, 0.06, 0.16, 0.26];
const DURATIONS = [0.5, 0.65, 0.45, 0.7, 0.55, 0.6, 0.48, 0.72, 0.52, 0.68, 0.44, 0.58, 0.62, 0.46, 0.74, 0.56, 0.42, 0.66, 0.5, 0.64];

export function RadioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-10">
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            background: "var(--color-primary)",
            height: isPlaying ? `${h}%` : "15%",
            opacity: isPlaying ? 0.8 : 0.25,
            animationName: isPlaying ? "eq-bar" : "none",
            animationDuration: `${DURATIONS[i]}s`,
            animationDelay: `${DELAYS[i]}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
          }}
        />
      ))}
      <style>{`
        @keyframes eq-bar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
