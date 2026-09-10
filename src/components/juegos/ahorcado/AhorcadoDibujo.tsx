// src/components/juegos/ahorcado/AhorcadoDibujo.tsx
interface AhorcadoDibujoProps {
  errores: number;
}

// Colores literales (no var(--color-*)) a propósito: no hay precedente en
// este repo de CSS custom properties dentro de atributos SVG (stroke/fill),
// así que se usa el hex directo del design system para no depender de un
// comportamiento de navegador sin verificar aquí.
const PARTES = [
  <circle key="cabeza" cx="140" cy="60" r="20" stroke="#F8F8FF" strokeWidth="3" fill="none" />,
  <line key="cuerpo" x1="140" y1="80" x2="140" y2="130" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="brazo-izq" x1="140" y1="90" x2="120" y2="110" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="brazo-der" x1="140" y1="90" x2="160" y2="110" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="pierna-izq" x1="140" y1="130" x2="120" y2="160" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="pierna-der" x1="140" y1="130" x2="160" y2="160" stroke="#F8F8FF" strokeWidth="3" />,
];

/** El muñeco se dibuja pieza por pieza, una por cada error — 6 errores = ahorcado completo. */
export function AhorcadoDibujo({ errores }: AhorcadoDibujoProps) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-56">
        <line x1="20" y1="180" x2="100" y2="180" stroke="#D4A017" strokeWidth="3" />
        <line x1="40" y1="180" x2="40" y2="20" stroke="#D4A017" strokeWidth="3" />
        <line x1="40" y1="20" x2="140" y2="20" stroke="#D4A017" strokeWidth="3" />
        <line x1="140" y1="20" x2="140" y2="40" stroke="#D4A017" strokeWidth="3" />
        {PARTES.slice(0, errores)}
      </svg>
    </div>
  );
}
