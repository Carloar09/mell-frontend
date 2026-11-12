import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
declare const google: any;

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private scriptPromise?: Promise<void>;

  private loadScript(): Promise<void> {
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      if ((window as any).google?.accounts?.id) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        this.scriptPromise = undefined; // permite reintentar
        reject(new Error('No se pudo cargar Google'));
      };
      document.head.appendChild(s);
    });

    return this.scriptPromise;
  }

  /** Dibuja el botón oficial de Google en `container`; llama a `onToken` con el ID token. */
  async renderButton(container: HTMLElement, onToken: (idToken: string) => void) {
    await this.loadScript();

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (resp: { credential: string }) => onToken(resp.credential),
    });

    const width = Math.min(400, Math.max(200, container.clientWidth || 320));
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      shape: 'pill',
      size: 'large',
      text: 'continue_with',
      logo_alignment: 'center',
      locale: 'es-419',
      width,
    });
  }
  readonly isNative = Capacitor.isNativePlatform();
  private nativeReady = false;

  /** Login nativo (APK): devuelve el ID token de Google. */
  async nativeLogin(): Promise<string> {
    if (!this.nativeReady) {
      await SocialLogin.initialize({ google: { webClientId: environment.googleClientId } });
      this.nativeReady = true;
    }
    const res: any = await SocialLogin.login({ provider: 'google', options: {} });
    const idToken = res?.result?.idToken;
    if (!idToken) throw new Error('Google no devolvió un ID token');
    return idToken;
  }
}
