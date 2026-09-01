import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { ClaimsPortfolioWidgetComponent } from './widgets/claims-portfolio-widget/claims-portfolio-widget.component';

// Tests the REAL Dashboard methods (not a copy) so a regression in the
// component is actually caught. Covers the bar-fill maths and the
// dormant-claim rule (30-day threshold) that drives the Dormant badge.
describe('Dashboard', () => {
  let component: Dashboard;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([])],
    });
    component = TestBed.createComponent(Dashboard).componentInstance;
  });

  describe('barWidth', () => {
    it('guards against divide-by-zero', () => {
      expect(component.barWidth(5, 0)).toBe(0);
    });
    it('returns a rounded percentage', () => {
      expect(component.barWidth(1, 3)).toBe(33);
      expect(component.barWidth(3, 3)).toBe(100);
    });
  });

  // The dormant rule moved to the portfolio widget when the dashboard was split
  // into widgets; this suite kept calling Dashboard.isDormant, which no longer
  // exists — a TS2339 that failed the whole `ng test` run, not just this file.
  describe('isDormant / daysSinceUpdate (30-day threshold)', () => {
    let widget: ClaimsPortfolioWidgetComponent;

    const iso = (daysAgo: number) =>
      new Date(Date.now() - daysAgo * 86400000).toISOString();

    beforeEach(() => {
      widget = TestBed.createComponent(ClaimsPortfolioWidgetComponent).componentInstance;
    });

    it('is not dormant when recently updated', () => {
      expect(widget.isDormant(iso(10))).toBe(false);
    });
    it('is dormant after 30+ days of no activity', () => {
      expect(widget.isDormant(iso(45))).toBe(true);
    });
    it('treats an empty date as not dormant', () => {
      expect(widget.isDormant('')).toBe(false);
    });
    it('reports elapsed whole days', () => {
      expect(widget.daysSinceUpdate(iso(12))).toBe(12);
    });
  });

  describe('roleBadgeLabel', () => {
    it('defaults to Claims Handler for the All persona', () => {
      expect(component.roleBadgeLabel()).toBe('Claims Handler');
    });
  });
});
