import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserAlert, AlertasService } from '../../alertas.service';

@Component({
  selector: 'app-alerts-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-modal.component.html',
  styleUrls: ['./alerts-modal.component.css']
})
export class AlertsModalComponent {
  @Input() isOpen = false;
  @Input() alertas: UserAlert[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() userEmail = '';
  @Output() close = new EventEmitter<void>();
  @Output() alertDeleted = new EventEmitter<string>();
  @Output() reload = new EventEmitter<void>();

  alertasEliminando: Record<string, boolean> = {};

  constructor(private alertasSvc: AlertasService) {}

  closeModal() {
    this.close.emit();
  }

  eliminarAlerta(a: UserAlert): void {
    if (!a || !a.id || !this.userEmail) return;
    if (!confirm('¿Eliminar esta alerta?')) return;

    this.alertasEliminando[a.id] = true;
    this.alertasSvc.eliminar(this.userEmail, a.id).subscribe({
      next: () => {
        delete this.alertasEliminando[a.id];
        this.alertDeleted.emit(a.id);
      },
      error: (e) => {
        delete this.alertasEliminando[a.id];
        const msg = e?.error?.message || e?.message || 'No se pudo eliminar la alerta';
        alert(msg);
      }
    });
  }

  getAlertTypeLabel(type: string): string {
    switch (type) {
      case 'NEW_CONTENT':
        return '📢 NUEVO CONTENIDO';
      case 'CONTENT_EXPIRING':
        return '⏰ CONTENIDO EXPIRA';
      case 'CONTENT_MATCHES_INTERESTS':
        return '🎯 CONTENIDO BASADO EN TUS GUSTOS';
      default:
        return type || 'ALERTA';
    }
  }

  reloadAlertas() {
    this.reload.emit();
  }
}
