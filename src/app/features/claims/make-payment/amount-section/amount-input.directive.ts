import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// A money field that shows "13,000" when you are not typing in it and the plain
// number while you are. NDBX has no number formatter, so this is the small
// local one; the form control still holds a plain number (or null).
@Directive({
  selector: 'input[appAmount]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AmountInputDirective), multi: true }],
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()'
  }
})
export class AmountInputDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private value: number | null = null;
  private focused = false;
  private onChange: (v: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: number | null): void {
    this.value = v;
    this.render();
  }

  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  onInput(): void {
    // Digits and one dot only; anything else typed or pasted is dropped.
    const cleaned = this.el.value.replace(/[^0-9.]/g, '').replace(/^(\d*\.\d*)\..*$/, '$1');
    if (cleaned !== this.el.value) this.el.value = cleaned;
    const n = cleaned === '' || cleaned === '.' ? null : Number(cleaned);
    this.value = n;
    this.onChange(n);
  }

  onFocus(): void {
    this.focused = true;
    this.render();
  }

  onBlur(): void {
    this.focused = false;
    this.render();
    this.onTouched();
  }

  private render(): void {
    if (this.value === null || this.value === undefined) this.el.value = '';
    else this.el.value = this.focused ? String(this.value) : this.value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
}
