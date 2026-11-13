import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  HEADS_UP_TEXTS,
  HEADS_UP_TEXT_MAX,
  HeadsUpTextKey,
  LargeLossHeadsUp,
  PREFILL_FIELDS,
  PrefillKey,
  YesNo
} from '../../../core/models/large-loss-heads-up.model';

// The Heads-Up form: built from the saved record, read back into a patch on
// save. Required fields (DESIGN DECISION HU-1 Q1) are only enforced on
// Submit: a draft can be saved half done.

export type ValuesGroup = FormGroup<Record<PrefillKey, FormControl<string>>>;
export type TextsGroup = FormGroup<Record<HeadsUpTextKey, FormControl<string>>>;

export interface HeadsUpForm {
  values: ValuesGroup;
  cat: FormControl<YesNo | null>;
  multipleLobs: FormControl<YesNo | null>;
  texts: TextsGroup;
}

const AMOUNT = /^\d+([.,]\d{1,2})?$/;
const PERCENT = /^(100|\d{1,2})([.,]\d{1,2})?$/;

export function buildHeadsUpForm(hu: LargeLossHeadsUp): FormGroup<HeadsUpForm> {
  const values = {} as Record<PrefillKey, FormControl<string>>;
  for (const f of PREFILL_FIELDS) {
    const v = hu.values?.[f.key] ?? hu.prefill?.[f.key] ?? '';
    const pattern = f.kind === 'amount' ? AMOUNT : f.kind === 'percent' ? PERCENT : null;
    values[f.key] = new FormControl(v, { nonNullable: true, validators: pattern ? [Validators.pattern(pattern)] : [] });
  }
  const texts = {} as Record<HeadsUpTextKey, FormControl<string>>;
  for (const t of HEADS_UP_TEXTS) {
    texts[t.key] = new FormControl(hu.texts?.[t.key] ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(HEADS_UP_TEXT_MAX)]
    });
  }
  return new FormGroup<HeadsUpForm>({
    values: new FormGroup(values),
    cat: new FormControl<YesNo | null>(hu.cat ?? null),
    multipleLobs: new FormControl<YesNo | null>(hu.multipleLobs ?? null),
    texts: new FormGroup(texts)
  });
}

/** Turn on "required" for Submit; returns the labels still missing. */
export function requireForSubmit(form: FormGroup<HeadsUpForm>): string[] {
  const missing: string[] = [];
  const need = (c: FormControl<string> | FormControl<YesNo | null>, label: string) => {
    c.addValidators(Validators.required);
    c.updateValueAndValidity();
    c.markAsTouched();
    if (c.invalid) missing.push(label);
  };
  for (const f of PREFILL_FIELDS) if (f.required) need(form.controls.values.controls[f.key], f.label);
  need(form.controls.cat, 'Cat event');
  need(form.controls.multipleLobs, 'Multiple LOBs affected');
  for (const t of HEADS_UP_TEXTS) if (t.required) need(form.controls.texts.controls[t.key], t.label);
  return missing;
}

/** Labels still missing, without touching the form (live summary update). */
export function stillMissing(form: FormGroup<HeadsUpForm>): string[] {
  const out: string[] = [];
  for (const f of PREFILL_FIELDS) {
    if (f.required && form.controls.values.controls[f.key].hasError('required')) out.push(f.label);
  }
  if (form.controls.cat.hasError('required')) out.push('Cat event');
  if (form.controls.multipleLobs.hasError('required')) out.push('Multiple LOBs affected');
  for (const t of HEADS_UP_TEXTS) if (t.required && form.controls.texts.controls[t.key].hasError('required')) out.push(t.label);
  return out;
}

/** Wrong formats block any save, draft included. */
export function formatErrors(form: FormGroup<HeadsUpForm>): string[] {
  form.markAllAsTouched();
  const out: string[] = [];
  for (const f of PREFILL_FIELDS) {
    if (form.controls.values.controls[f.key].hasError('pattern')) out.push(f.label);
  }
  return out;
}

/** What the handler changed, as a patch on the record. Only real overrides. */
export function readHeadsUpForm(form: FormGroup<HeadsUpForm>, hu: LargeLossHeadsUp): Partial<LargeLossHeadsUp> {
  const raw = form.getRawValue();
  const values: Partial<Record<PrefillKey, string>> = {};
  for (const f of PREFILL_FIELDS) {
    const v = (raw.values[f.key] ?? '').trim();
    if (v !== (hu.prefill?.[f.key] ?? '')) values[f.key] = v;
  }
  const texts: Partial<Record<HeadsUpTextKey, string>> = {};
  for (const t of HEADS_UP_TEXTS) texts[t.key] = raw.texts[t.key] ?? '';
  return { values, texts, cat: raw.cat, multipleLobs: raw.multipleLobs };
}
