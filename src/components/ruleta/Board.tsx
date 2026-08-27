import type { RuletaBoardTile } from "@/types";

export function Board({ tiles }: { tiles: RuletaBoardTile[] }) {
  return (
    <div
      className="flex flex-wrap gap-1.5 justify-center rounded-xl p-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0f6b34, #072d18 85%)", border: "3px solid #A07810" }}
    >
      {tiles.map((tile, i) =>
        tile.type === "space" ? (
          <div key={i} style={{ width: 12 }} />
        ) : (
          <div
            key={i}
            className="flex items-center justify-center rounded font-bold"
            style={{
              width: 28, height: 34,
              background: tile.char ? "linear-gradient(160deg,#123a63,#081527)" : "linear-gradient(160deg,#0e2c4c,#081527)",
              border: "2px solid #0a1626",
              color: "#fff",
              fontSize: "1rem",
            }}
          >
            {tile.char ?? ""}
          </div>
        )
      )}
    </div>
  );
}
