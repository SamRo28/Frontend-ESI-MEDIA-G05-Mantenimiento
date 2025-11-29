import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-avatar-selector-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './avatar-selector-modal.component.html',
    styleUrls: ['./avatar-selector-modal.component.css']
})
export class AvatarSelectorModalComponent {
    @Input() avatars: string[] = [];
    @Input() selectedAvatar: string | null = null;

    @Output() close = new EventEmitter<void>();
    @Output() select = new EventEmitter<string>();

    onClose() {
        this.close.emit();
    }

    onSelect(avatar: string) {
        this.select.emit(avatar);
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') this.onClose();
    }
}
