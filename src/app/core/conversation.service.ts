import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AssistantResponse {
  conversationId: number | string;
  messageId: number | string;
  replyText: string;
  audioBase64: string | null;
  crisisEscalated: boolean;
  hotlineMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  send(audio: Blob, conversationId: number | string | null) {
    // Whisper deduce el formato por la extensión, así que normalizamos el tipo
    const baseType = (audio.type || 'audio/webm').split(';')[0];
    const ext = baseType.includes('mp4') ? 'm4a' : baseType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audio], `voice.${ext}`, { type: baseType });

    const form = new FormData();
    form.append('userId', String(this.auth.user()!.userId));
    if (conversationId != null) form.append('conversationId', String(conversationId));
    form.append('audio', file);

    return this.http.post<AssistantResponse>(
      `${environment.apiUrl}/conversations/messages`,
      form
    );
  }
  greet() {
    const form = new FormData();
    form.append('userId', String(this.auth.user()!.userId));
    return this.http.post<AssistantResponse>(
      `${environment.apiUrl}/conversations/greeting`,
      form
    );
  }
}
