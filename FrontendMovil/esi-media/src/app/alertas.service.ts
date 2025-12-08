import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export type AlertType = 'NEW_CONTENT' | 'CONTENT_EXPIRING';

export interface UserAlert {
  id: string;
  type: AlertType;
  contenidoId?: string;
  tituloContenido?: string;
  mensaje?: string;
  vipOnly?: boolean;
  minEdad?: number;
  creadaEn?: string;
  disponibleHasta?: string;
}

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly baseUrl = `http://${environment.apiHost}:8081/users/alertas`;

  constructor(private http: HttpClient) {}

  listar(email: string): Observable<UserAlert[]> {
    const e = encodeURIComponent(email);
    return this.http.get<UserAlert[]>(`${this.baseUrl}?email=${e}`);
  }

  eliminar(email: string, alertId: string): Observable<void> {
    const e = encodeURIComponent(email);
    const id = encodeURIComponent(alertId);
    return this.http.delete<void>(`${this.baseUrl}/${id}?email=${e}`);
  }
}
