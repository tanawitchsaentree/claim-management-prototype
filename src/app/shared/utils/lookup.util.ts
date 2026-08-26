/** Resolves a lookup option's display label by value, falling back to the raw key if not found. */
export function lookupLabel<T extends { value: string; label: string }>(options: T[], key: string): string {
  return options.find(o => o.value === key)?.label ?? key;
}
