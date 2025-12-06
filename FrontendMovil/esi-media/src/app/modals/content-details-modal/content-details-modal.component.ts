import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StarRatingComponent } from '../../star-rating/star-rating.component';
import { Contenido } from '../../auth/models';

@Component({
    selector: 'app-content-details-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, StarRatingComponent],
    templateUrl: './content-details-modal.component.html',
    styleUrls: ['./content-details-modal.component.css']
})
export class ContentDetailsModalComponent {
    @Input() content!: Contenido;
    @Input() userEmail: string = '';
    @Input() isUsuario: boolean = false;
    @Input() readOnly: boolean = false;
    @Input() misListas: any[] = [];
    @Input() isFav: boolean = false;
    @Input() pendingToggle: boolean = false;

    // List management state passed from parent or handled locally?
    // The parent has `selectedListaPorContenido`, `creandoListaContenido`, etc. keyed by ID.
    // Since this modal is for a SINGLE content, we can simplify.
    @Input() creatingList: boolean = false;
    @Input() msgListaOk: string | null = null;
    @Input() msgListaError: string | null = null;

    @Output() close = new EventEmitter<void>();
    @Output() play = new EventEmitter<void>();
    @Output() toggleFav = new EventEmitter<void>();
    @Output() toggleRating = new EventEmitter<void>();
    @Output() rate = new EventEmitter<any>();
    @Output() addToList = new EventEmitter<string>(); // emits listaId

    selectedListaId: string = '';
    isRatingOpen: boolean = false;

    onClose() {
        this.close.emit();
    }

    onPlay(e: Event) {
        e.stopPropagation();
        this.play.emit();
    }

    onToggleFav(e: Event) {
        e.stopPropagation();
        this.toggleFav.emit();
    }

    onToggleRating(e: Event) {
        e.stopPropagation();
        // If we want to open the rating panel inside the modal
        this.isRatingOpen = !this.isRatingOpen;
        this.toggleRating.emit();
    }

    onRate(event: any) {
        this.rate.emit(event);
        this.isRatingOpen = false;
    }

    onAddToList() {
        if (this.selectedListaId) {
            this.addToList.emit(this.selectedListaId);
        }
    }

    closeRating() {
        this.isRatingOpen = false;
    }
}
