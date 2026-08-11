export function connectRadioBridge(wsUrl: string, key: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; message?: string };
        if (msg.type === "ready") {
          ws.removeEventListener("message", onMessage);
          resolve(ws);
        } else if (msg.type === "error") {
          ws.removeEventListener("message", onMessage);
          reject(new Error(msg.message ?? "El bridge de radio rechazó la conexión"));
          ws.close();
        }
      } catch {
        // ignora mensajes no-JSON (no deberían llegar antes de "ready")
      }
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", () => reject(new Error("No se pudo conectar al bridge de radio")));
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
  });
}

export class AudioMixer {
  readonly context: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;
  private sources = new Map<string, MediaStreamAudioSourceNode>();

  constructor() {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
  }

  connect(key: string, stream: MediaStream) {
    if (this.sources.has(key)) return;
    const source = this.context.createMediaStreamSource(stream);
    source.connect(this.destination);
    this.sources.set(key, source);
  }

  disconnect(key: string) {
    const source = this.sources.get(key);
    if (!source) return;
    source.disconnect();
    this.sources.delete(key);
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }

  close() {
    this.sources.forEach((source) => source.disconnect());
    this.sources.clear();
    void this.context.close();
  }
}

export async function captureTabAudio(): Promise<MediaStreamTrack> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  const audioTracks = displayStream.getAudioTracks();
  displayStream.getVideoTracks().forEach((track) => track.stop());

  if (audioTracks.length === 0) {
    throw new Error("No se compartió audio. Vuelve a intentar y marca la casilla de compartir audio de la pestaña/pantalla.");
  }

  return audioTracks[0];
}

function pickBroadcastMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function startStreamingToBridge(stream: MediaStream, ws: WebSocket): MediaRecorder {
  const mimeType = pickBroadcastMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(e.data);
    }
  };

  recorder.start(250);
  return recorder;
}
