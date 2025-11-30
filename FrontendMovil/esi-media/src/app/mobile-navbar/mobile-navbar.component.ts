import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-mobile-navbar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './mobile-navbar.component.html',
    styleUrls: ['./mobile-navbar.component.css']
})
export class MobileNavbarComponent {
    @Input() filtersActive: boolean = false;
    @Output() toggleFilters = new EventEmitter<void>();
    @Output() openProfile = new EventEmitter<void>();
    @Output() logout = new EventEmitter<void>();
    @Output() home = new EventEmitter<void>();
}
