// src/components/juegos/palabra/estilos.ts
//
// Animaciones del tablero (giro al revelar, "pop" al escribir, sacudida
// cuando la palabra no es válida). Van con prefijo palabra- para no chocar
// con nada de globals.css.
export const ESTILOS_PALABRA = `
@keyframes palabra-girar {
  0% { transform: rotateX(0deg); background: var(--color-surface); border-color: var(--color-text-muted); }
  49.9% { transform: rotateX(90deg); background: var(--color-surface); border-color: var(--color-text-muted); }
  50% { transform: rotateX(90deg); background: var(--palabra-ficha-bg); border-color: transparent; }
  100% { transform: rotateX(0deg); background: var(--palabra-ficha-bg); border-color: transparent; }
}
.palabra-girar { animation-name: palabra-girar; animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
@keyframes palabra-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
.palabra-pop { animation: palabra-pop 120ms ease-out; }
@keyframes palabra-sacudir {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-6px); }
  40%, 60% { transform: translateX(6px); }
}
.palabra-sacudir { animation: palabra-sacudir 500ms ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  .palabra-girar, .palabra-pop, .palabra-sacudir { animation-duration: 1ms !important; animation-delay: 0ms !important; }
}
`;
