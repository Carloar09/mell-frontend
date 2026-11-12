import { Injectable, signal } from '@angular/core';

export interface ListenOptions {
  threshold?: number;   // volumen mínimo para considerar "voz"
  silenceMs?: number;   // silencio que cierra la frase
  noSpeechMs?: number;  // espera máxima si nadie habla
  maxMs?: number;       // duración máxima de una frase
  minVoiceMs?: number;  // voz mínima acumulada para no enviar ruidos sueltos
  segmentMs?: number;   // tramo de grabación que se descarta si no hubo voz
}

@Injectable({ providedIn: 'root' })
export class VoiceCaptureService {
  /** Volumen en vivo (0–~0.5) para animar el orbe */
  readonly level = signal(0);

  private stream?: MediaStream;
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private raf = 0;
  private abort?: () => void;

  private async ensureStream() {
    if (this.stream?.active && this.ctx && this.analyser) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
  }

  private pickMime(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m));
  }

  /** Graba una frase. Devuelve el audio, o null si no se oyó a nadie (o se canceló). */
  async listenOnce(opts: ListenOptions = {}): Promise<Blob | null> {
    const {
      threshold = 0.025,
      silenceMs = 1100,
      noSpeechMs = 5000,
      maxMs = 60000,
      minVoiceMs = 350,
      segmentMs = 1200,
    } = opts;

    await this.ensureStream();
    const mime = this.pickMime();
    const samples = new Uint8Array(this.analyser!.fftSize);

    const startSegment = () => {
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(this.stream!, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.start();
      return { rec, chunks, startedAt: performance.now() };
    };

    return new Promise<Blob | null>((resolve) => {
      let seg = startSegment();
      const t0 = seg.startedAt;
      let last = t0;
      let lastVoice = t0;
      let voicedMs = 0;
      let finished = false;

      const finish = (blob: Blob | null) => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(this.raf);
        this.level.set(0);
        this.abort = undefined;
        resolve(blob);
      };

      this.abort = () => {
        try {
          if (seg.rec.state === 'recording') seg.rec.stop();
        } catch {}
        finish(null);
      };

      const tick = () => {
        if (finished) return;
        const analyser = this.analyser;
        if (!analyser) {
          finish(null);
          return;
        }

        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / samples.length);
        this.level.set(rms);

        const now = performance.now();
        if (rms > threshold) {
          voicedMs += now - last;
          lastVoice = now;
        }
        last = now;

        const heard = voicedMs >= minVoiceMs;

        // Aún no hay voz confirmada y llevamos un rato en silencio:
        // descartamos el tramo para no enviar silencio a Whisper.
        if (!heard && now - lastVoice > segmentMs && now - seg.startedAt > segmentMs) {
          const old = seg.rec;
          seg = startSegment(); // el nuevo arranca antes de parar el viejo: sin huecos
          voicedMs = 0;
          try {
            if (old.state === 'recording') old.stop(); // sin onstop: se descarta
          } catch {}
        }

        const done =
          (heard && now - lastVoice > silenceMs) ||
          (!heard && now - t0 > noSpeechMs) ||
          now - t0 > maxMs;

        if (done) {
          const { rec, chunks } = seg;
          if (!heard) {
            try {
              if (rec.state === 'recording') rec.stop();
            } catch {}
            finish(null);
            return;
          }
          rec.onstop = () => finish(new Blob(chunks, { type: rec.mimeType }));
          rec.stop();
          return;
        }

        this.raf = requestAnimationFrame(tick);
      };

      tick();
    });
  }

  /** Cancela la grabación en curso sin devolver audio */
  cancel() {
    this.abort?.();
  }

  /** Libera el micrófono (el indicador de grabación del teléfono se apaga) */
  release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = undefined;
    this.ctx = undefined;
    this.analyser = undefined;
  }
}
