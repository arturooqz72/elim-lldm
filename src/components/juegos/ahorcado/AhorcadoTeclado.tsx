// src/components/juegos/ahorcado/AhorcadoTeclado.tsx
const LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

interface AhorcadoTecladoProps {
  palabra: string;
  letrasAdivinadas: string[];
  disabled: boolean;
  onLetra: (letra: string) => void;
}

export function AhorcadoTeclado({ palabra, letrasAdivinadas, disabled, onLetra }: AhorcadoTecladoProps) {
  return (
    <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
      {LETRAS.map((letra) => {
        const yaUsada = letrasAdivinadas.includes(letra);
        const esCorrecta = palabra.includes(letra);

        return (
          <button
            key={letra}
            type="button"
            onClick={() => onLetra(letra)}
            disabled={yaUsada || disabled}
            className="h-11 rounded-xl text-sm font-bold"
            style={{
              background: yaUsada
                ? esCorrecta
                  ? "rgba(74,222,128,0.15)"
                  : "rgba(248,113,113,0.15)"
                : "var(--color-surface-elevated)",
              border: `1px solid ${
                yaUsada
                  ? esCorrecta
                    ? "rgba(74,222,128,0.4)"
                    : "rgba(248,113,113,0.4)"
                  : "var(--color-border)"
              }`,
              color: yaUsada
                ? esCorrecta
                  ? "var(--color-success)"
                  : "var(--color-destructive)"
                : "var(--color-text)",
              opacity: yaUsada || disabled ? 0.7 : 1,
            }}
          >
            {letra}
          </button>
        );
      })}
    </div>
  );
}
