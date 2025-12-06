import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-edit-profile-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './edit-profile-modal.component.html',
    styleUrls: ['./edit-profile-modal.component.css']
})
export class EditProfileModalComponent {
    @Input() userEmail: string = '';
    @Input() model: any = {};
    @Input() readOnly: boolean = false;

    @Input() aliasError: string | null = null;
    @Input() aliasChecking: boolean = false;
    @Input() aliasTaken: boolean = false;

    @Input() saving: boolean = false;
    @Input() okMsg: string | null = null;
    @Input() errorMsg: string = '';

    @Input() selectedAvatar: string | null = null;

    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<void>();
    @Output() darDeBaja = new EventEmitter<void>();
    @Output() openAvatarModal = new EventEmitter<void>();

    @Output() aliasChange = new EventEmitter<string>();
    @Output() vipChange = new EventEmitter<boolean>();

    onClose() {
        this.close.emit();
    }

    onSave() {
        this.save.emit();
    }

    onDarDeBaja() {
        this.darDeBaja.emit();
    }

    onOpenAvatarModal() {
        this.openAvatarModal.emit();
    }

    onAliasModelChange(val: string) {
        this.model.alias = val;
        this.aliasChange.emit(val);
    }

    onVipModelChange(val: boolean) {
        this.model.vip = val;
        this.vipChange.emit(val);
    }
}
