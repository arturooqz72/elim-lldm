/**
 * Micrófono manejado 100% por la app en vez de por LiveKit directamente.
 *
 * El combo nativo de LiveKit (useMediaDeviceSelect + track.setProcessor
 * para el volumen) resultó frágil: al cambiar de dispositivo con un
 * processor activo, el track publicado se queda sonando con el
 * dispositivo viejo aunque la UI ya muestre el nuevo seleccionado.
 *
 * En vez de pelear con ese ciclo de vida, este track publicado NUNCA
 * cambia — es la salida fija de un GainNode propio. Cambiar de
 * dispositivo solo desconecta la fuente vieja y conecta una nueva al
 * mismo GainNode; LiveKit nunca se entera ni necesita reiniciar nada.
 */
export class ManagedMic {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly destination: MediaStreamAudioDestinationNode;
  private currentSource: MediaStreamAudioSourceNode | null = null;
  private currentRawStream: MediaStream | null = null;
  private currentDeviceId: string | undefined;

  readonly outputTrack: MediaStreamTrack;

  constructor() {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.destination = this.context.createMediaStreamDestination();
    this.gain.connect(this.destination);
    this.outputTrack = this.destination.stream.getAudioTracks()[0];
  }

  get deviceId(): string | undefined {
    return this.currentDeviceId;
  }

  async setDevice(deviceId?: string): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const oldSource = this.currentSource;
    const oldStream = this.currentRawStream;

    const source = this.context.createMediaStreamSource(stream);
    source.connect(this.gain);
    this.currentSource = source;
    this.currentRawStream = stream;
    this.currentDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId;

    // Se conecta la fuente nueva antes de soltar la vieja para no dejar
    // un hueco de silencio mientras el usuario cambia de dispositivo.
    oldSource?.disconnect();
    oldStream?.getTracks().forEach((t) => t.stop());
  }

  setVolume(volume: number) {
    this.gain.gain.value = Math.max(0, Math.min(2, volume));
  }

  close() {
    this.currentSource?.disconnect();
    this.currentRawStream?.getTracks().forEach((t) => t.stop());
    this.currentSource = null;
    this.currentRawStream = null;
    this.context.close().catch(() => {});
  }
}
