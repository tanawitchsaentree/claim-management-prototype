import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HeadsUpItem, NewsItem, CalendarEvent, ProviderExpense, FinancialClosurePeriod, ReserveMovement } from '../../models';
import headsUpData from '../data/heads-up.json';
import newsData from '../data/news.json';
import calendarData from '../data/calendar-events.json';
import providerData from '../data/provider-expenses.json';
import reserveMovementsData from '../data/reserve-movements.json';

@Injectable({ providedIn: 'root' })
export class MockDashboardExtendedService {
  getHeadsUp(): Observable<HeadsUpItem[]> {
    return of(headsUpData as HeadsUpItem[]);
  }

  getNews(): Observable<NewsItem[]> {
    return of(newsData as NewsItem[]);
  }

  getCalendarEvents(): Observable<CalendarEvent[]> {
    return of(calendarData as CalendarEvent[]);
  }

  getProviderExpenses(): Observable<ProviderExpense[]> {
    return of(providerData as ProviderExpense[]);
  }

  getReserveMovements(): Observable<ReserveMovement[]> {
    return of(reserveMovementsData as ReserveMovement[]);
  }

  getFinancialClosurePeriod(): Observable<FinancialClosurePeriod> {
    return of({
      active: true,
      start: '2026-06-25',
      end: '2026-07-02',
      message: 'Q2 Financial Closure Period: 25 June – 2 July. All reserve movements and payments above €50k require Head of Claims approval.',
    });
  }
}
