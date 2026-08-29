import { MessageCircle, Users } from "lucide-react";

function whatsappHref(whatsapp: string, nombre: string) {
  const digits = whatsapp.replace(/[^\d]/g, "");
  const mensaje = `¡La Paz del Señor, ${nombre}! 👋 Te invito a jugar en Elim LLDM 🎮 Entra aquí: https://www.elimlldm.net/juegos — ¡Dios te bendiga!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}

export function JugadoresEnLineaList({
  jugadores,
  currentUserId,
}: {
  jugadores: { id: string; user_id: string; nombre: string; whatsapp: string }[];
  currentUserId: string;
}) {
  if (jugadores.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center gap-2"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Users size={22} style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Todavía nadie se ha sumado a la lista de jugadores.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl divide-y overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {jugadores.map((j) => (
        <div
          key={j.id}
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
              {j.nombre}
              {j.user_id === currentUserId && (
                <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                  (tú)
                </span>
              )}
            </p>
          </div>

          {j.user_id !== currentUserId && (
            <a
              href={whatsappHref(j.whatsapp, j.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-opacity hover:opacity-85"
              style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.35)", color: "#25D366" }}
            >
              <MessageCircle size={14} />
              Invitar por WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
