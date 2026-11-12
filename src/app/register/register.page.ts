import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  imports: [IonContent, FormsModule, RouterLink],
})
export class RegisterPage {
  firstName = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  join() {
    if (!this.firstName.trim() || !this.email || !this.password) {
      this.error.set('Completa todos los campos.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.firstName.trim(), this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/home'),
      error: (e) => {
        this.loading.set(false);
        this.error.set(
          e.status === 0
            ? 'No se pudo conectar con el servidor.'
            : 'No se pudo crear la cuenta. ¿Ya existe ese correo?'
        );
      },
    });
  }
}
