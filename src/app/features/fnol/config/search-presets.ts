export interface SearchPreset {
  label: string;
  clientName?: string;
  policyNumber?: string;
}

export const SEARCH_PRESETS: Record<string, SearchPreset> = {
  'kaufmann-pol1': {
    label: 'Liver Tea Group — POL-2024-001',
    clientName:   'Liver Tea Group',
    policyNumber: 'POL-2024-001',
  },
  'kaufmann-pol6': {
    label: 'Schäfer & Söhne — POL-2024-006',
    clientName:   'Schäfer & Söhne',
    policyNumber: 'POL-2024-006',
  },
  'auto': {
    label: 'Auto (use what I typed)',
  },
};
