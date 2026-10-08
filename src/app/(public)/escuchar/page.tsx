import { getNowPlaying } from "@/lib/azuracast/api";
import { RadioEnVivo } from "@/components/radio/RadioEnVivo";

// Página directa de la radio: el enlace para compartir y la pantalla de la
// app instalable Radio Elim. Usa el mismo stream que /radio.
export default async function EscucharPage() {
  const datos = await getNowPlaying();

  return (
    <div
      className="min-h-[calc(100vh-4rem)] px-4 py-8 flex items-start justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(212,160,23,0.14) 0%, rgba(10,10,18,0) 60%), var(--color-bg)",
      }}
    >
      <RadioEnVivo
        inicial={{
          titulo: datos?.now_playing.song.title || undefined,
          artista: datos?.now_playing.song.artist || undefined,
          locutor: datos?.live.is_live ? datos.live.streamer_name || undefined : undefined,
          oyentes: datos?.listeners.current,
        }}
      />
    </div>
  );
}
