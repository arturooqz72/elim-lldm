export type TikTokTriviaBridgeMessage =
  | { type: "connected" }
  | { type: "winner"; tiktokUsername: string; tiktokDisplayName: string; answer: "a" | "b" | "c" | "d"; ts: number }
  | { type: "error"; reason?: "not_live" | "tiktok_disconnected" | "connect_failed"; message?: string };

/**
 * Conecta al bridge de trivia de TikTok y resuelve cuando confirma la
 * conexión con "ready" — mismo patrón que connectRadioBridge() en
 * src/lib/radio-broadcast.ts, pero para un servicio distinto.
 */
export function connectTikTokTriviaBridge(wsUrl: string, key: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; message?: string };
        if (msg.type === "ready") {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
          resolve(ws);
        } else if (msg.type === "error") {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
          reject(new Error(msg.message ?? "El bridge de trivia de TikTok rechazó la conexión"));
          ws.close();
        }
      } catch {
        // ignora mensajes no-JSON (no deberían llegar antes de "ready")
      }
    };

    const onClose = () => reject(new Error("La conexión se cerró antes de confirmarse"));

    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", () => {
      reject(new Error("No se pudo conectar al bridge de trivia de TikTok"));
      ws.close();
    });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
  });
}

export function sendBridgeMessage(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
