import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { of } from 'rxjs';
import { EditLossInformationComponent } from './edit-loss-information.component';
import { editLossInformationCanDeactivate } from './edit-loss-information.guard';

// Gate Proof tests for the safety-review acceptance criteria — these exercise
// the REAL component methods/signals (pendingChanges, hasHighImpactChange,
// confirmLeaveIfDirty, onSaveChanges) and the REAL exported guard function,
// not re-typed copies, so a regression in the component is what actually
// fails these.
//
// NxDialogService is overridden at the DI level (not spied on the real
// singleton) — the real .open() attaches a live NDBX modal/overlay that never
// settles in a headless test DOM, which reads as a hang, not a failure.
describe('EditLossInformationComponent — Gate Proof', () => {
  let component: EditLossInformationComponent;
  let fakeDialogOpen: ReturnType<typeof vi.fn>;

  const mount = async (claimId: string): Promise<void> => {
    TestBed.resetTestingModule();
    fakeDialogOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [EditLossInformationComponent],
      providers: [
        // A wildcard route so onSaveChanges()'s post-save router.navigate()
        // resolves cleanly instead of rejecting with "cannot match any
        // routes" — noise, not a failure, but worth keeping the test output clean.
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: claimId }) } },
        },
        { provide: NxDialogService, useValue: { open: fakeDialogOpen } },
      ],
    });
    // NxModalModule (imported directly into this standalone component) appears
    // to re-provide NxDialogService at the component's own injector level,
    // which shadows a TestBed-root override — overriding at the component
    // level directly is what actually wins.
    TestBed.overrideComponent(EditLossInformationComponent, {
      add: { providers: [{ provide: NxDialogService, useValue: { open: fakeDialogOpen } }] },
    });
    const fixture = TestBed.createComponent(EditLossInformationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit -> the mock services' async load
    // MockBaseService.respond() delays by the active scenario's delayMs — give
    // the real load time to resolve rather than mocking it away.
    await new Promise(r => setTimeout(r, 400));
    fixture.detectChanges();
  };

  // CLM-2024-001 is one of the 5 claims loss-information.json hand-authors.
  beforeEach(async () => { await mount('CLM-2024-001'); });

  describe('Gate 1 — Save is unreachable while the ledger is empty', () => {
    it('has zero pending changes right after load', () => {
      expect(component.pendingChanges().length).toBe(0);
    });

    it('the exact condition Save\'s [disabled] binding uses is true when nothing changed', () => {
      expect(component.pendingChanges().length === 0 || component.saving()).toBe(true);
    });

    it('becomes reachable the moment a field changes', () => {
      component.form.get('lossDescription')!.setValue('changed value');
      expect(component.pendingChanges().length).toBeGreaterThan(0);
      expect(component.pendingChanges().length === 0 || component.saving()).toBe(false);
    });
  });

  describe('Gate 2 — leaving with pending changes is intercepted', () => {
    it('confirmLeaveIfDirty allows leaving immediately with no pending changes (no dialog opened)', async () => {
      const canLeave = await component.confirmLeaveIfDirty();
      expect(fakeDialogOpen).not.toHaveBeenCalled();
      expect(canLeave).toBe(true);
    });

    it('confirmLeaveIfDirty opens the discard modal and blocks when the user keeps editing', async () => {
      component.form.get('lossDescription')!.setValue('changed value');
      fakeDialogOpen.mockReturnValue({ afterClosed: () => of(null) });
      const canLeave = await component.confirmLeaveIfDirty();
      expect(fakeDialogOpen).toHaveBeenCalled();
      expect(canLeave).toBe(false);
    });

    it('the exported canDeactivate guard delegates to the component and allows leaving on Discard', async () => {
      component.form.get('lossDescription')!.setValue('changed value');
      fakeDialogOpen.mockReturnValue({ afterClosed: () => of('discard') });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (editLossInformationCanDeactivate as any)(component, {}, {}, {});
      expect(result).toBe(true);
    });
  });

  describe('Gate 3 — confirm modal does not fire for a low-impact-only change set', () => {
    it('hasHighImpactChange is false for a Loss description-only edit', () => {
      component.form.get('lossDescription')!.setValue('changed value');
      expect(component.hasHighImpactChange()).toBe(false);
    });

    it('onSaveChanges does not open the confirm modal for a low-impact-only change', async () => {
      component.form.get('lossDescription')!.setValue('changed value');
      await component.onSaveChanges();
      expect(fakeDialogOpen).not.toHaveBeenCalled();
    });

    it('onSaveChanges DOES open the confirm modal when Cause of loss (high-impact) changed', async () => {
      component.form.get('causeOfLoss')!.setValue(['fire', 'lightning']);
      expect(component.hasHighImpactChange()).toBe(true);
      fakeDialogOpen.mockReturnValue({ afterClosed: () => of(null) });
      await component.onSaveChanges();
      expect(fakeDialogOpen).toHaveBeenCalled();
    });
  });

  // 22 of the 27 claims in claims.json have no hand-authored loss-information
  // record. Before MockLossInformationService synthesized one, the screen loaded
  // with `original` null, every field read "Not provided", computeDiffs()
  // returned [] no matter what was typed, and Save stayed disabled forever.
  describe('Gate 4 — a claim with no hand-authored record is still editable', () => {
    beforeEach(async () => { await mount('CLM-2024-003'); });

    it('loads a record synthesized from the Claim, not an empty form', () => {
      expect(component.original()).not.toBeNull();
      expect(component.form.get('lossDescription')!.value).toContain('Rotterdam');
      expect(component.dateOfLoss.get('dateOfOccurrence')!.value).toBe('2024-02-18');
      expect(component.lossLocation.value.locations.length).toBe(1);
    });

    it('is valid on load, so Save is not blocked by a hidden required field', () => {
      expect(component.form.valid).toBe(true);
    });

    it('registers a pending change and reaches the save path', async () => {
      component.form.get('lossDescription')!.setValue('Revised after survey report.');
      expect(component.pendingChanges().length).toBe(1);
      await component.onSaveChanges();
      expect(component.saveBlocked()).toBeNull();
      expect(component.saveSuccess()).toBe(true);
    });

    it('names the missing field and reopens its group when a required value is cleared', async () => {
      component.form.get('lossDescription')!.setValue('');
      await component.onSaveChanges();
      expect(component.saveBlocked()).toContain('Loss description');
      expect(component.isEditing('lossDescription')).toBe(true);
    });
  });
});
