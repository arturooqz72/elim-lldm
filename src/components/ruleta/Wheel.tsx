"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WHEEL_SEGMENTS, SEG_COLORS } from "@/lib/ruleta/wheel";

interface WheelProps {
  size?: number;
  spinToSegment: number | null; // set by the parent when a SPIN_RESULT arrives
  onSpinClick: () => void;
  canSpin: boolean;
}

const SEG_ANGLE = 360 / WHEEL_SEGMENTS.length;

export function Wheel({ size = 260, spinToSegment, onSpinClick, canSpin }: WheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const lastAppliedIndex = useRef<number | null>(null);

  useEffect(() => {
    if (spinToSegment === null || spinToSegment === lastAppliedIndex.current) return;
    lastAppliedIndex.current = spinToSegment;

    const effectiveAngle = spinToSegment * SEG_ANGLE + SEG_ANGLE / 2;
    const finalMod = (360 - effectiveAngle + 360) % 360;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const total = rotationRef.current + extraSpins * 360 + finalMod;
    rotationRef.current = total;

    setSpinning(true);
    setRotation(total);
    const t = setTimeout(() => setSpinning(false), 4000);
    return () => clearTimeout(t);
  }, [spinToSegment]);

  const gradient = useMemo(() => {
    const parts = WHEEL_SEGMENTS.map((_, i) => {
      const color = SEG_COLORS[i % SEG_COLORS.length];
      return `${color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`;
    });
    return `conic-gradient(${parts.join(",")})`;
  }, []);

  const dividers = useMemo(() => {
    return WHEEL_SEGMENTS.map((_, i) => {
      const angle = (i * SEG_ANGLE - 90) * (Math.PI / 180);
      const x2 = 50 + 49 * Math.cos(angle);
      const y2 = 50 + 49 * Math.sin(angle);
      return { x1: 50, y1: 50, x2, y2 };
    });
  }, []);

  const R = size / 2;
  const centerRadius = R * 0.6;

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ position: "relative", width: size, height: size }}>
        <div
          style={{
            position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
            borderTop: "24px solid var(--color-primary)", zIndex: 6,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))",
          }}
        />
        <div
          style={{
            width: size, height: size, borderRadius: "50%",
            border: "6px solid var(--color-primary-dark, #A07810)",
            boxShadow: "0 0 0 3px #2a1505, 0 10px 30px rgba(0,0,0,.6)",
            position: "relative",
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.15,0.7,0.25,1)" : "none",
          }}
        >
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {dividers.map((d, i) => (
              <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="rgba(255,230,170,.6)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {WHEEL_SEGMENTS.map((seg, i) => {
            const mid = i * SEG_ANGLE + SEG_ANGLE / 2;
            const isBankrupt = seg.type === "bancarrota";
            const isLoseTurn = seg.type === "pierde_turno";
            const width = isBankrupt || isLoseTurn ? size * 0.15 : size * 0.19;
            const fontSize = isBankrupt ? size * 0.1 : isLoseTurn ? size * 0.088 : Math.max(9, size * 0.05);
            const tx = centerRadius - width / 2;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: "50%", top: "50%", transformOrigin: "0 0",
                  width, fontSize, textAlign: "center", fontWeight: 700, color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,.8)", lineHeight: 1,
                  transform: `rotate(${mid}deg) translate(${tx}px, ${-fontSize * 0.42}px)`,
                }}
              >
                {isBankrupt ? "💀" : isLoseTurn ? "😴" : seg.label}
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 34, height: 34, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #fff8dc, var(--color-primary) 55%, #A07810)",
            border: "2px solid #2a1505", zIndex: 4,
          }}
        />
      </div>
      <button
        onClick={onSpinClick}
        disabled={!canSpin || spinning}
        className="w-full rounded-2xl py-4 text-lg font-bold transition-all duration-200"
        style={{
          background: canSpin && !spinning ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: canSpin && !spinning ? "#000" : "var(--color-text-muted)",
        }}
      >
        Girar la ruleta
      </button>
    </div>
  );
}
