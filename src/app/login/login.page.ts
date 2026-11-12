import { AfterViewInit, Component, ElementRef, NgZone, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { GoogleAuthService } from '../core/google-auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  imports: [IonContent, FormsModule, RouterLink],
})
export class LoginPage implements AfterViewInit {
  @ViewChild('googleBtn') googleBtn?: ElementRef<HTMLDivElement>;

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  isNative: boolean;

  constructor(
    private auth: AuthService,
    private router: Router,
    private googleAuth: GoogleAuthService,
    private zone: NgZone
  ) {
    this.isNative = this.googleAuth.isNative;
  }

  ngAfterViewInit() {
    if (this.isNative) return; // en el APK no se usa el botón web de Google

    const el = this.googleBtn?.nativeElement;
    if (!el) return;
    this.googleAuth
      .renderButton(el, (idToken) => this.zone.run(() => this.loginWithGoogle(idToken)))
      .catch(() => this.error.set('No se pudo cargar el acceso con Google.'));
  }

  enter() {
    if (!this.email || !this.password) {
      this.error.set('Escribe tu correo y contraseña.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/home'),
      error: (e) => {
        this.loading.set(false);
        this.error.set(
          e.status === 0
            ? 'No se pudo conectar con el servidor.'
            : 'Correo o contraseña incorrectos.'
        );
      },
    });
  }

  /** Login nativo con Google (APK) */
  async googleNative() {
    this.error.set('');
    try {
      const idToken = await this.googleAuth.nativeLogin();
      this.loginWithGoogle(idToken);
    } catch {
      this.error.set('No se pudo iniciar sesión con Google.');
    }
  }

  private loginWithGoogle(idToken: string) {
    this.loading.set(true);
    this.error.set('');
    this.auth.loginWithGoogle(idToken).subscribe({
      next: () => this.router.navigateByUrl('/home'),
      error: (e) => {
        this.loading.set(false);
        this.error.set(
          e.status === 0
            ? 'No se pudo conectar con el servidor.'
            : 'No se pudo iniciar sesión con Google.'
        );
      },
    });
  }
}
