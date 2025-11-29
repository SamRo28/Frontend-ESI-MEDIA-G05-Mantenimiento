import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface ListaPublica {
  id?: string;
  nombre: string;
  descripcion: string;
  userEmail: string;
  contenidosIds: string[];
}

@Injectable({ providedIn: 'root' })
export class ListasPublicasService {
  private readonly apiUrl = `http://${environment.apiHost}:8082/listas`;

  constructor(private http: HttpClient) { }

  crearLista(lista: ListaPublica): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(this.apiUrl, lista);
  }

  listarListas(): Observable<ListaPublica[]> {
    return this.http.get<ListaPublica[]>(`http://${environment.apiHost}:8082/listas/publicas`);
  }


  eliminarLista(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  añadirContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(`${this.apiUrl}/${listaId}/contenidos/${contenidoId}`, {});
  }

  eliminarContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.delete<ListaPublica>(`${this.apiUrl}/${listaId}/contenidos/${contenidoId}`);
  }
}
