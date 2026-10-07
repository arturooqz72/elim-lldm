// public/ingles/grabadora-worklet.js
// AudioWorklet de Elim English (modo Pronunciación): copia las muestras
// crudas del micrófono (canal 0) y las manda al hilo principal en bloques de
// 4096, donde se reducen a 16 kHz y se arma el WAV (src/lib/ingles/wav.ts).
// Capturar PCM directo evita los formatos distintos de MediaRecorder en
// Chrome (webm/opus) y Safari (mp4/aac).

class GrabadoraPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bloque = new Float32Array(4096);
    this.pos = 0;
    this.port.onmessage = (e) => {
      if (e.data === "vaciar") {
        if (this.pos > 0) this.port.postMessage(this.bloque.slice(0, this.pos));
        this.pos = 0;
        this.port.postMessage("vaciado");
      }
    };
  }

  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    if (canal) {
      for (let i = 0; i < canal.length; i++) {
        this.bloque[this.pos++] = canal[i];
        if (this.pos === this.bloque.length) {
          this.port.postMessage(this.bloque.slice(0));
          this.pos = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("grabadora-pcm", GrabadoraPcm);
