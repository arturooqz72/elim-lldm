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
@keyframes palabra-pista-aparece {
  0% { opacity: 0; transform: scale(0.92); box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
  60% { opacity: 1; transform: scale(1.03); box-shadow: 0 0 0 6px rgba(74,222,128,0.25); }
  100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(74,222,128,0); }
}
.palabra-pista-aparece { animation: palabra-pista-aparece 700ms ease-out; }
/* Pantallas bajas (menos de 720px de alto, con las dos tarjetas de pistas):
   el tablero baja hasta 170px de ancho y la letra se ajusta al tamaño de la
   ficha (cqw = % del ancho del tablero) para que tablero + teclado quepan sin
   scroll. Arriba de 720px el tablero se ve igual que siempre. */
@media (max-height: 719px) {
  .palabra-tablero { container-type: inline-size; max-width: clamp(170px, calc((100dvh - 450px) / 1.2), 330px) !important; }
  .palabra-ficha { font-size: clamp(0.9rem, 9cqw, 1.4rem) !important; line-height: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .palabra-girar, .palabra-pop, .palabra-sacudir, .palabra-pista-aparece { animation-duration: 1ms !important; animation-delay: 0ms !important; }
}
`;
