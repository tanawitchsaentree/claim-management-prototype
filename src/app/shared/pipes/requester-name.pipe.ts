import { Pipe, PipeTransform } from '@angular/core';

// Approval/payment mock data stores `requester` as a raw email
// (e.g. "c.wolff@allianz.com", "extern.d.kiel@allianz.com") — fine as an
// identity key for filtering, but shown as-is it reads as a login, not a
// person, unlike the reference UI which always shows a name. KNOWN_NAMES
// covers people already named elsewhere in this app's mock data (e.g.
// "n.feld@allianz.com" = Nina Feld, per user-directory.json); anything
// else is derived from the email's local-part rather than left raw.
const KNOWN_NAMES: Record<string, string> = {
  'n.feld@allianz.com': 'Nina Feld'
};

@Pipe({
  name: 'requesterName',
  standalone: true
})
export class RequesterNamePipe implements PipeTransform {
  transform(email: string | null | undefined): string {
    if (!email) return '—';
    const known = KNOWN_NAMES[email.toLowerCase()];
    if (known) return known;

    const local = email.split('@')[0];
    const isExternal = local.startsWith('extern.');
    const nameParts = (isExternal ? local.slice('extern.'.length) : local).split('.');
    const formatted = nameParts
      .filter(Boolean)
      .map(part => (part.length <= 2 ? `${part.charAt(0).toUpperCase()}.` : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' ');
    return isExternal ? `${formatted} (External)` : formatted;
  }
}
