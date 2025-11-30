import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';

@Component({
    selector: 'app-media-player-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './media-player-modal.component.html',
    styleUrls: ['./media-player-modal.component.css']
})
export class MediaPlayerModalComponent {
    @Input() playingTitle: string | null = null;
    @Input() playerKind: 'AUDIO' | 'VIDEO' | 'EMBED' = 'VIDEO';
    @Input() playerSrc: string | null = null;
    @Input() embedUrl: SafeResourceUrl | null = null;

    @Output() close = new EventEmitter<void>();

    @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>;
    @ViewChild('audioEl') audioRef?: ElementRef<HTMLAudioElement>;

    onClose() {
        // Pause media before closing
        if (this.videoRef?.nativeElement) {
            this.videoRef.nativeElement.pause();
        }
        if (this.audioRef?.nativeElement) {
            this.audioRef.nativeElement.pause();
        }
        this.close.emit();
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') this.onClose();
    }
}
