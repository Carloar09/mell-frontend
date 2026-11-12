import { Component, OnDestroy, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ConversationService } from '../core/conversation.service';
import { VoiceCaptureService } from '../core/voice-capture.service';

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';
type Segment = 'listening' | 'speaking' | 'silence';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent],
})
export class HomePage implements OnDestroy {
  state = signal<OrbState>('idle');
  error = signal('');
  crisis = signal('');
  silence = signal(false);

  readonly segments: { key: Segment; label: string }[] = [
    { key: 'listening', label: 'Listening' },
    { key: 'speaking', label: 'Speaking' },
    { key: 'silence', label: 'Silence (5s)' },
  ];

  /** Segmento resaltado en la pastilla (null en reposo) */
  active = computed<Segment | null>(() => {
    const s = this.state();
    if (s === 'idle') return null;
    if (s === 'speaking') return 'speaking';
    if (s === 'listening' && this.silence() && this.voice.level() < 0.025) return 'silence';
    return 'listening'; // "pensando" se muestra como escuchando, para que se sienta continuo
  });

  /** Escala del orbe según el volumen de la voz */
  scale = computed(() => 1 + Math.min(this.voice.level() * 4, 0.5));

  private running = false;
  private conversationId: number | string | null = null;
  private player?: HTMLAudioElement;
  private playResolve?: () => void;

  constructor(
    private voice: VoiceCaptureService,
    private conv: ConversationService,
    private auth: AuthService,
    private router: Router
  ) {}

  toggle() {
    if (this.running) {
      this.stop();
    } else {
      this.error.set('');
      this.crisis.set('');
      this.loop();
    }
  }

  private async loop() {
    this.running = true;
    try {
      if (this.conversationId == null) await this.greet();

      while (this.running) {
        this.state.set('listening');
        const blob = await this.voice.listenOnce({ silenceMs: 1100, noSpeechMs: 5000 });
        if (!this.running) break;

        if (!blob) {
          this.silence.set(true); // 5 s sin voz: sigue escuchando
          continue;
        }
        this.silence.set(false);

        this.state.set('processing');
        const res = await firstValueFrom(this.conv.send(blob, this.conversationId));
        if (!this.running) break;

        this.conversationId = res.conversationId;

        if (res.crisisEscalated) {
          this.crisis.set(res.hotlineMessage ?? res.replyText);
          break; // en crisis no hay audio: se muestra el texto
        }

        if (res.audioBase64) {
          this.state.set('speaking');
          await this.play(res.audioBase64);
        }
      }
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        this.error.set('Necesito permiso de micrófono para escucharte.');
      } else if (e?.status === 0) {
        this.error.set('No se pudo conectar con el servidor.');
      } else {
        this.error.set('Algo salió mal. Intenta de nuevo.');
      }
    } finally {
      this.stop();
    }
  }

  /** Saludo de voz al iniciar. Si falla, se sigue directo a escuchar. */
  private async greet() {
    try {
      this.state.set('processing');
      const res = await firstValueFrom(this.conv.greet());
      if (!this.running) return;
      this.conversationId = res.conversationId;
      if (res.audioBase64) {
        this.state.set('speaking');
        await this.play(res.audioBase64);
      }
    } catch {
      /* sin saludo, la conversación sigue normal */
    }
  }

  stop() {
    this.running = false;
    this.silence.set(false);
    this.voice.cancel();
    this.voice.release();
    this.player?.pause();
    this.playResolve?.();
    this.state.set('idle');
  }

  private play(b64: string): Promise<void> {
    return new Promise((resolve) => {
      this.playResolve = resolve;
      const audio = new Audio('data:audio/mpeg;base64,' + b64);
      this.player = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }

  dismissCrisis() {
    this.crisis.set('');
  }

  logout() {
    this.stop();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  ngOnDestroy() {
    this.stop();
  }
}
