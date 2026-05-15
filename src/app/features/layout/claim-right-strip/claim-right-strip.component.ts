import { Component } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';

interface StripItem {
  icon: string;
  label: string;
  key: string;
}

@Component({
  selector: 'app-claim-right-strip',
  standalone: true,
  imports: [NxIconModule],
  templateUrl: './claim-right-strip.component.html',
  styleUrl: './claim-right-strip.component.scss',
})
export class ClaimRightStripComponent {
  activeKey: string | null = null;
  collapsed = false;

  readonly items: StripItem[] = [
    { icon: 'info-circle-o',   label: 'Claim info',    key: 'info' },
    { icon: 'bolt-o',          label: 'Quick actions', key: 'actions' },
    { icon: 'speech-bubble-o', label: 'Comments',      key: 'comments' },
    { icon: 'set-timer',       label: 'History',       key: 'history' },
    { icon: 'paperclip',       label: 'Attachments',   key: 'attachments' },
  ];

  activate(key: string): void {
    this.activeKey = this.activeKey === key ? null : key;
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }
}
