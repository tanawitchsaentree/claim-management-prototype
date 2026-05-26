import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Broker, BrokerSearchFilters } from '../../models/broker.model';

const SEED_BROKERS: Broker[] = [
  // ── Company brokers ────────────────────────────────────────────────
  {
    brokerId:  'BRK-001',
    partyType: 'company',
    legalName: 'Marsh insurance brokers GmbH',
    tradeName: 'Mark Rust',
    address:   'Friedrichstraße 90, Berlin, DE',
    ipmId:     'IPM-BRK-00127',
    status:    'cleared',
    country:   'DE',
    role:      'Broker',
    city:      'Berlin',
    zipCode:   '10117',
    street:    'Friedrichstraße 90',
  },
  {
    brokerId:  'BRK-002',
    partyType: 'company',
    legalName: 'Marsh & McLennan companies UK',
    tradeName: 'Marsh UK',
    address:   '1 Tower Place West, London, UK',
    ipmId:     'IPM-BRK-00127',
    status:    'not-cleared',
    country:   'GB',
    role:      'Broker',
    city:      'London',
    zipCode:   'EC3R 5BU',
    street:    '1 Tower Place West',
  },
  {
    brokerId:  'BRK-003',
    partyType: 'company',
    legalName: 'Marsh & McLennan companies UK Ltd',
    tradeName: 'Marsh UK',
    address:   '1 Tower Place West, London, UK',
    ipmId:     'IPM-BRK-00127',
    status:    'cleared',
    country:   'GB',
    role:      'Broker',
    city:      'London',
    zipCode:   'EC3R 5BU',
    street:    '1 Tower Place West',
  },
  {
    brokerId:  'BRK-004',
    partyType: 'company',
    legalName: 'Aon Versicherungsmakler Deutschland',
    tradeName: 'Aon DE',
    address:   'Caffamacherreihe 16, Hamburg, DE',
    ipmId:     'IPM-BRK-00482',
    status:    'cleared',
    country:   'DE',
    role:      'Broker',
    city:      'Hamburg',
    zipCode:   '20355',
    street:    'Caffamacherreihe 16',
  },
  {
    brokerId:  'BRK-005',
    partyType: 'company',
    legalName: 'Willis Towers Watson FR',
    tradeName: 'WTW Paris',
    address:   '12 Place des États-Unis, Paris, FR',
    ipmId:     'IPM-BRK-00733',
    status:    'pending',
    country:   'FR',
    role:      'Broker',
    city:      'Paris',
    zipCode:   '75116',
    street:    '12 Place des États-Unis',
  },

  // ── Individual brokers ─────────────────────────────────────────────
  {
    brokerId:    'BRK-101',
    partyType:   'individual',
    legalName:   'Anna Müller',
    firstName:   'Anna',
    lastName:    'Müller',
    dateOfBirth: '1982-04-12',
    address:     'Kantstraße 22, Berlin, DE',
    ipmId:       'IPM-IND-01032',
    status:      'cleared',
    country:     'DE',
    role:        'Broker',
    city:        'Berlin',
    zipCode:     '10623',
    street:      'Kantstraße 22',
  },
  {
    brokerId:    'BRK-102',
    partyType:   'individual',
    legalName:   'James O\'Connor',
    firstName:   'James',
    lastName:    'O\'Connor',
    dateOfBirth: '1975-09-30',
    address:     '24 Baker Street, London, UK',
    ipmId:       'IPM-IND-01188',
    status:      'cleared',
    country:     'GB',
    role:        'Broker',
    city:        'London',
    zipCode:     'NW1 6XE',
    street:      '24 Baker Street',
  },
  {
    brokerId:    'BRK-103',
    partyType:   'individual',
    legalName:   'Sophie Laurent',
    firstName:   'Sophie',
    lastName:    'Laurent',
    dateOfBirth: '1990-01-21',
    address:     '5 Rue de Rivoli, Paris, FR',
    ipmId:       'IPM-IND-01244',
    status:      'pending',
    country:     'FR',
    role:        'Broker',
    city:        'Paris',
    zipCode:     '75004',
    street:      '5 Rue de Rivoli',
  },
  {
    brokerId:    'BRK-104',
    partyType:   'individual',
    legalName:   'Marco Rossi',
    firstName:   'Marco',
    lastName:    'Rossi',
    dateOfBirth: '1968-12-03',
    address:     'Via del Corso 41, Rome, IT',
    ipmId:       'IPM-IND-01302',
    status:      'not-cleared',
    country:     'IT',
    role:        'Broker',
    city:        'Rome',
    zipCode:     '00186',
    street:      'Via del Corso 41',
  },
  {
    brokerId:    'BRK-105',
    partyType:   'individual',
    legalName:   'Emma Schneider',
    firstName:   'Emma',
    lastName:    'Schneider',
    dateOfBirth: '1986-06-17',
    address:     'Königsallee 8, Düsseldorf, DE',
    ipmId:       'IPM-IND-01388',
    status:      'cleared',
    country:     'DE',
    role:        'Broker',
    city:        'Düsseldorf',
    zipCode:     '40212',
    street:      'Königsallee 8',
  },
];

const MOCK_DELAY_MS = 350;

@Injectable({ providedIn: 'root' })
export class MockBrokerService {
  private readonly cache: Broker[] = SEED_BROKERS.map(b => ({ ...b }));

  search(filters: BrokerSearchFilters): Observable<Broker[]> {
    const f = filters;
    const matches = this.cache.filter(b => {
      if (f.partyType && b.partyType !== f.partyType) return false;
      if (f.legalName && !b.legalName.toLowerCase().includes(f.legalName.toLowerCase())
          && !(b.tradeName ?? '').toLowerCase().includes(f.legalName.toLowerCase())
          && !b.ipmId.toLowerCase().includes(f.legalName.toLowerCase())) return false;
      if (f.firstName && !(b.firstName ?? '').toLowerCase().includes(f.firstName.toLowerCase())) return false;
      if (f.lastName  && !(b.lastName  ?? '').toLowerCase().includes(f.lastName.toLowerCase()))  return false;
      if (f.country && b.country !== f.country) return false;
      if (f.city && !(b.city ?? '').toLowerCase().includes(f.city.toLowerCase())) return false;
      if (f.zipCode && !(b.zipCode ?? '').startsWith(f.zipCode)) return false;
      if (f.street && !(b.street ?? '').toLowerCase().includes(f.street.toLowerCase())) return false;
      if (f.idValue && !b.ipmId.toLowerCase().includes(f.idValue.toLowerCase())) return false;
      return true;
    });
    return of(matches).pipe(delay(MOCK_DELAY_MS));
  }
}
