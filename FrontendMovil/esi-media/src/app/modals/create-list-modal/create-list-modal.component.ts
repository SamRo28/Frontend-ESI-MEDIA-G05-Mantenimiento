import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-create-list-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './create-list-modal.component.html',
    styleUrls: ['./create-list-modal.component.css']
})
export class CreateListModalComponent {
    @Input() nombre: string = '';
    @Input() descripcion: string = '';
    @Input() creating: boolean = false;
    @Input() okMsg: string | null = null;
    @Input() errorMsg: string | null = null;

    @Output() close = new EventEmitter<void>();
    @Output() create = new EventEmitter<void>();
    @Output() nombreChange = new EventEmitter<string>();
    @Output() descripcionChange = new EventEmitter<string>();

    onClose() {
        this.close.emit();
    }

    onCreate() {
        this.create.emit();
    }

    onNombreChange(val: string) {
        this.nombre = val;
        this.nombreChange.emit(val);
    }

    onDescripcionChange(val: string) {
        this.descripcion = val;
        this.descripcionChange.emit(val);
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') this.onClose();
    }
}
