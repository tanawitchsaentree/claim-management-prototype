/** Test-page-only data for /mock/vendor-dropdown. Not used by any real screen. */
export interface MockVendor {
  id: string;
  businessName: string;
  taxId: string;
  address: string;
  country: string;
  email: string;
  phone: string;
}

/**
 * How the Salvage vendor dropdown lets the handler clear a choice.
 * current     = "Select" is a real, pickable option (what the screen does today)
 * placeholder = "Select" is only placeholder text; remove the row with the bin
 * none        = a "None" option at the top of the list clears the choice
 * clear       = "Select" is placeholder only; once a vendor is picked a
 *               "Clear selection" option appears at the top of the list
 */
export type ClearMode = 'current' | 'placeholder' | 'none' | 'clear';

export const MOCK_VENDORS: MockVendor[] = [
  {
    id: 'v-weber',
    businessName: 'Weber Inc',
    taxId: 'fb86791ca1cb-403a-9bac',
    address: '1013 Stokes Wells, New Merle, Mayotte 37260-2876',
    country: 'BE',
    email: 'somkiatmartin@weberinc.com',
    phone: '+11 1111111'
  },
  {
    id: 'v-wanjala',
    businessName: 'WanjalaWilkinson - Dare',
    taxId: '6927.02',
    address: '47 Jade Shore, Venamouth, Dominican Republic 55722-2498',
    country: 'BE',
    email: 'jianping.deng963@gmx.dev',
    phone: '+11 1111111'
  },
  {
    id: 'v-kessler',
    businessName: 'Kessler Salvage GmbH',
    taxId: 'DE811234567',
    address: 'Hafenstrasse 12, 20457 Hamburg',
    country: 'DE',
    email: 'dispatch@kessler-salvage.example',
    phone: '+49 40 1234567'
  }
];
