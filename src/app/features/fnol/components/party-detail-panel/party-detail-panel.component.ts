import { Component, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { Party, PARTY_ROLE_LABELS, ID_TYPE_LABELS } from '../../../../core/models/party.model';

@Component({
  selector: 'app-party-detail-panel',
  standalone: true,
  imports: [CommonModule, NxButtonModule, NxIconModule, StatusChipComponent],
  templateUrl: './party-detail-panel.component.html',
  styleUrl: './party-detail-panel.component.scss',
})
export class PartyDetailPanelComponent implements OnChanges {
  @Input({ required: true }) party!: Party;
  @Input() open = false;
  @Output() closePanel = new EventEmitter<void>();

  idTypeLabel = '';

  ngOnChanges(): void {
    this.idTypeLabel = this.party?.idType ? (ID_TYPE_LABELS[this.party.idType] ?? this.party.idType) : '';
  }

  rolesDisplay(): string {
    return this.party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.closePanel.emit();
  }

  onClose(): void { this.closePanel.emit(); }
}
