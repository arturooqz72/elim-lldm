export function connectRadioBridge(wsUrl: string, key: string): Promise<WebSocket> {
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
          reject(new Error(msg.message ?? "El bridge de radio rechazó la conexión"));
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
      reject(new Error("No se pudo conectar al bridge de radio"));
      ws.close();
    });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
  });
}

export class AudioMixer {
  readonly context: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;
  private sources = new Map<string, MediaStreamAudioSourceNode>();
  private keepAlive: AudioBufferSourceNode | null = null;

  constructor() {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
    void this.context.resume();
    this.startKeepAlive();
  }

  /**
   * Ruido de piso casi imperceptible, siempre presente mientras dure la
   * transmisión. Si se apagan mic/sala/PC y no suena ningún clip, la
   * mezcla queda en silencio digital puro — y la estación (AzuraCast)
   * puede detectarlo y caer sola a su programación normal (síntoma
   * reportado: "apago el mic y empieza a sonar la radio normal"). Esto
   * evita el silencio absoluto sin que se note al oído.
   */
  private startKeepAlive() {
    const durationSeconds = 2;
    const length = Math.floor(this.context.sampleRate * durationSeconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.destination);
    source.start();
    this.keepAlive = source;
  }

  connect(key: string, stream: MediaStream) {
    const existing = this.sources.get(key);
    const newTrack = stream.getAudioTracks()[0];
    if (existing) {
      const existingTrack = existing.mediaStream.getAudioTracks()[0];
      if (existingTrack === newTrack) return;
      existing.disconnect();
    }
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
    this.keepAlive?.stop();
    this.keepAlive?.disconnect();
    this.keepAlive = null;
    this.context.close().catch(() => {});
  }

  /**
   * Reproduce un clip de audio (ej. intro/salida de un programa) hacia
   * la mezcla que sale a la radio — no hacia las bocinas locales, igual
   * que el resto de las fuentes de este mixer. Resuelve cuando el clip
   * termina de sonar, para poder encadenar acciones (ej. desconectar
   * después de la salida). Sin control de pausa/volumen — para eso usar
   * loadClip() + LiveClip.
   */
  async playClip(url: string): Promise<void> {
    const clip = await this.loadClip(url);
    return new Promise((resolve) => {
      clip.onEnded = resolve;
      clip.play();
    });
  }

  /**
   * Descarga y decodifica un clip, devolviendo un control interactivo
   * (play/pausa/detener/volumen) conectado a la mezcla que sale a la
   * radio. A diferencia de playClip(), no empieza a sonar solo.
   */
  async loadClip(url: string): Promise<LiveClip> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el clip (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    return new LiveClip(this.context, this.destination, audioBuffer);
  }
}

/**
 * Un clip de audio con transporte completo (play/pausa/detener/volumen)
 * sonando hacia un AudioMixer. AudioBufferSourceNode nativo no soporta
 * pausar — solo start()/stop() una sola vez — así que pause() recuerda
 * en qué segundo iba (offset) y crea un nodo nuevo al reanudar.
 */
export class LiveClip {
  private source: AudioBufferSourceNode | null = null;
  private readonly gain: GainNode;
  private offset = 0;
  private startedAt = 0;
  private playing = false;
  onEnded?: () => void;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly buffer: AudioBuffer
  ) {
    this.gain = context.createGain();
    this.gain.connect(destination);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.buffer.duration;
  }

  play() {
    if (this.playing) return;
    if (this.offset >= this.buffer.duration) this.offset = 0;

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    source.onended = () => {
      // Un stop()/pause() manual también dispara onended — ignorar si ya
      // no es el nodo activo (evita reportar "terminó" de un nodo viejo).
      if (this.source !== source) return;
      this.playing = false;
      this.offset = 0;
      this.source = null;
      this.onEnded?.();
    };
    source.start(0, this.offset);
    this.startedAt = this.context.currentTime;
    this.source = source;
    this.playing = true;
  }

  pause() {
    if (!this.playing || !this.source) return;
    this.offset += this.context.currentTime - this.startedAt;
    this.source.onended = null;
    this.source.stop();
    this.source = null;
    this.playing = false;
  }

  stop() {
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source = null;
    }
    this.playing = false;
    this.offset = 0;
  }

  setVolume(volume: number) {
    this.gain.gain.value = Math.max(0, Math.min(1, volume));
  }

  disconnect() {
    this.stop();
    this.gain.disconnect();
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

  recorder.onerror = (event) => {
    console.error("MediaRecorder error:", event);
  };

  recorder.start(250);
  return recorder;
}
