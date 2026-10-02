import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { of } from 'rxjs';
import { EditLossInformationComponent } from './edit-loss-information.component';
import { editLossInformationCanDeactivate } from './edit-loss-information.guard';

// Gate Proof tests for the safety-review acceptance criteria — these exercise
// the REAL component methods/signals (pendingChanges, confirmLeaveIfDirty,
// onUpdateAll/onCancelField) and the REAL exported guard function, not
// re-typed copies, so a regression in the component is what actually fails
// these.
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
        // A wildcard route so onDiscard()'s post-discard router.navigate()
        // resolves cleanly instead of rejecting with "cannot match any
        // routes" — noise, not a failure, but worth keeping the test output clean.
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: claimId }) } }
        },
        { provide: NxDialogService, useValue: { open: fakeDialogOpen } }
      ]
    });
    // NxModalModule (imported directly into this standalone component) appears
    // to re-provide NxDialogService at the component's own injector level,
    // which shadows a TestBed-root override — overriding at the component
    // level directly is what actually wins.
    TestBed.overrideComponent(EditLossInformationComponent, {
      add: { providers: [{ provide: NxDialogService, useValue: { open: fakeDialogOpen } }] }
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
  beforeEach(async () => {
    await mount('CLM-2024-001');
  });

  describe('Gate 1 — pendingChanges reacts to any field edit', () => {
    it('has zero pending changes right after load', () => {
      expect(component.pendingChanges().length).toBe(0);
    });

    it('becomes non-zero the moment a field changes', () => {
      component.form.get('lossDescription')!.setValue('changed value');
      expect(component.pendingChanges().length).toBeGreaterThan(0);
    });
  });

  describe('Gate 2 — leaving mid-edit is intercepted', () => {
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

    it('onDiscard resets the form to original before navigating, so the guard does not re-open the modal on its own navigate() call', async () => {
      component.form.get('lossDescription')!.setValue('changed value');
      fakeDialogOpen.mockReturnValue({ afterClosed: () => of('discard') });
      await component.onDiscard();
      expect(component.pendingChanges().length).toBe(0);
    });
  });

  // REVERSED on 2026-10-02. Gate 3 used to assert the opposite — that every
  // save opened a confirm modal with no exceptions (user mandate from
  // 2026-09-02: "เวลาจะ save change ให้ modal ด้วย อย่า save แล้วจบ"). Per-field
  // Save/Cancel came and went in between; this is the third shape — any
  // number of fields can sit "Edited" uncommitted at once, and one Update
  // button commits all of them together, still with no modal (the fields'
  // own inputs already show the new values plainly; nothing is hidden the
  // way a single-click batch save used to hide it). Kept as a gate rather
  // than deleted, since "Update pops a redundant confirm modal" is precisely
  // the regression to catch if this ever drifts back.
  describe('Gate 3 — Update commits every pending field at once, no confirm modal', () => {
    it('onUpdateAll does not open any dialog', async () => {
      component.form.get('lossDescription')!.setValue('changed value');
      await component.onUpdateAll();
      expect(fakeDialogOpen).not.toHaveBeenCalled();
    });

    it('onUpdateAll commits every edited field in one call, even ones left closed/uncommitted', async () => {
      component.startEdit('lossDescription');
      component.form.get('lossDescription')!.setValue('changed description');
      component.startEdit('typeOfDamage'); // closes lossDescription's edit mode without saving/cancelling it
      component.form.get('typeOfDamage')!.setValue(['fire-damage']);
      expect(component.pendingChanges().length).toBe(2);

      await component.onUpdateAll();

      expect(component.fieldChanged('lossDescription')).toBe(false);
      expect(component.fieldChanged('typeOfDamage')).toBe(false);
      expect(component.pendingChanges().length).toBe(0);
    });

    it('onUpdateAll does nothing when there is no diff', async () => {
      await component.onUpdateAll();
      expect(component.saving()).toBe(false);
    });

    it('onCancelField reverts the field to its original value without saving', () => {
      const before = component.form.get('lossDescription')!.value;
      component.startEdit('lossDescription');
      component.form.get('lossDescription')!.setValue('should not persist');
      component.onCancelField('lossDescription');
      expect(component.form.get('lossDescription')!.value).toBe(before);
      expect(component.isEditing('lossDescription')).toBe(false);
    });

    it('cancelling Cause of loss also reverts Incident circumstance, since editing the cause can silently invalidate it', () => {
      const originalCircumstance = component.form.get('circumstance')!.value;
      component.startEdit('causeOfLoss');
      component.form.get('causeOfLoss')!.setValue(['other-event']); // a cause that invalidates most circumstances
      component.onCauseOfLossChange(['other-event']);
      component.onCancelField('causeOfLoss');
      expect(component.form.get('causeOfLoss')!.value).toEqual(
        component.original()?.causeOfLoss ?? []
      );
      expect(component.form.get('circumstance')!.value).toBe(originalCircumstance);
    });
  });

  // 22 of the 27 claims in claims.json have no hand-authored loss-information
  // record. Before MockLossInformationService synthesized one, the screen loaded
  // with `original` null, every field read "Not provided", computeDiffs()
  // returned [] no matter what was typed, and Save stayed disabled forever.
  describe('Gate 4 — a claim with no hand-authored record is still editable', () => {
    beforeEach(async () => {
      await mount('CLM-2024-003');
    });

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
      component.startEdit('lossDescription');
      component.form.get('lossDescription')!.setValue('Revised after survey report.');
      expect(component.pendingChanges().length).toBe(1);
      await component.onUpdateAll();
      expect(component.fieldChanged('lossDescription')).toBe(false);
      expect(component.saveBlocked()).toBeNull();
    });

    it('refuses to update and reopens the field holding the missing value', async () => {
      component.startEdit('lossDescription');
      component.form.get('lossDescription')!.setValue('');
      await component.onUpdateAll();
      expect(component.form.get('lossDescription')!.invalid).toBe(true);
      expect(component.isEditing('lossDescription')).toBe(true);
      expect(component.saveBlocked()).not.toBeNull();
    });
  });
});
