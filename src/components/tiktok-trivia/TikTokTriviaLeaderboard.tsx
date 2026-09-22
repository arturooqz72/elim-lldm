export interface TikTokLeaderboardEntry {
  tiktokUsername: string;
  tiktokDisplayName: string;
  points: number;
}

interface TikTokTriviaLeaderboardProps {
  entries: TikTokLeaderboardEntry[];
}

export function TikTokTriviaLeaderboard({ entries }: TikTokTriviaLeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);

  if (sorted.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Todavía nadie ha acertado ninguna pregunta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((entry, index) => (
        <div
          key={entry.tiktokUsername}
          className="flex items-center justify-between px-4 py-2.5 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold w-5" style={{ color: "var(--color-text-muted)" }}>
              {index + 1}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {entry.tiktokDisplayName}
              </span>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                @{entry.tiktokUsername}
              </span>
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
            {entry.points} pts
          </span>
        </div>
      ))}
    </div>
  );
}
