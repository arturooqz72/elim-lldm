import type { Track } from "livekit-client";
import type { AudioProcessorOptions, TrackProcessor } from "livekit-client";

/**
 * TrackProcessor de LiveKit que inserta un GainNode entre el micrófono
 * capturado y lo que se publica a la sala — para poder subir/bajar el
 * volumen del mic en vivo. LiveKit no expone un control de volumen para
 * el audio saliente por su cuenta; el mecanismo soportado para modificar
 * el track antes de publicarlo es justo este (ver LocalAudioTrack.setProcessor).
 */
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = "mic-gain";
  processedTrack?: MediaStreamTrack;

  private gainNode: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private volume = 1;

  async init(opts: AudioProcessorOptions) {
    this.teardown();

    this.source = opts.audioContext.createMediaStreamSource(new MediaStream([opts.track]));
    this.gainNode = opts.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    this.destination = opts.audioContext.createMediaStreamDestination();

    this.source.connect(this.gainNode);
    this.gainNode.connect(this.destination);

    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions) {
    await this.init(opts);
  }

  async destroy() {
    this.teardown();
  }

  private teardown() {
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.source = null;
    this.gainNode = null;
    this.destination = null;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(2, volume));
    if (this.gainNode) this.gainNode.gain.value = this.volume;
  }
}
