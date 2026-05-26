export interface MassEvent {
  id:         string;          // ME-2025.102
  code:       string;          // Y66JGR02
  name:       string;          // US-CA Earthquake 2025
  type?:      string;
  dateStart:  string;          // ISO yyyy-mm-dd
  dateEnd:    string;          // ISO yyyy-mm-dd
  timeStart?: string;          // HH:mm
  timeEnd?:   string;          // HH:mm
  country:    string;
  region:     string;
  lossCause?: string;
  globalCatCode?: string;
  productCode?:   string;
  description?:   string;
  postcodes?: string[];
}

export interface MassEventFilters {
  id?:        string;
  code?:      string;
  name?:      string;
  dateStartFrom?: string;
  dateStartTo?:   string;
  country?:   string;
  region?:    string;
  lossCause?: string;
}
