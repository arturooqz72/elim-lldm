import { ALPHABET, VOWELS } from "@/lib/ruleta/wheel";

interface LettersProps {
  letrasProbadas: string[];
  canGuessConsonant: boolean;
  canAffordVowel: boolean;
  disabled: boolean;
  onGuess: (letra: string) => void;
}

export function Letters({ letrasProbadas, canGuessConsonant, canAffordVowel, disabled, onGuess }: LettersProps) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {ALPHABET.map((letter) => {
        const isVowel = VOWELS.includes(letter);
        const tried = letrasProbadas.includes(letter);
        const enabled = !disabled && !tried && (isVowel ? canAffordVowel : canGuessConsonant);
        return (
          <button
            key={letter}
            onClick={() => onGuess(letter)}
            disabled={!enabled}
            className="rounded-full font-bold transition-transform"
            style={{
              width: 34, height: 34,
              background: !enabled
                ? "linear-gradient(160deg,#333,#161616)"
                : isVowel
                ? "linear-gradient(160deg,var(--color-primary-light),#A07810)"
                : "linear-gradient(160deg,#e2f0ff,#9fc4ea)",
              color: !enabled ? "#666" : isVowel ? "#2a1505" : "#0f2a4a",
              border: "1px solid rgba(0,0,0,.25)",
            }}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
