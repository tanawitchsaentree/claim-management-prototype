export type BrokerStatus = 'cleared' | 'not-cleared' | 'pending';

// Name Management distinguishes Company vs Individual records.
// Company entries use legalName/tradeName; Individual entries use firstName/lastName.
export type BrokerPartyType = 'company' | 'individual';

export interface Broker {
  brokerId:    string;
  partyType:   BrokerPartyType;
  legalName:   string;          // Company: legal name; Individual: full display name
  tradeName?:  string;          // Trade / DBA name (company only)
  firstName?:  string;          // Individual only
  lastName?:   string;          // Individual only
  dateOfBirth?: string;         // Individual only — ISO yyyy-mm-dd
  address:     string;
  ipmId:       string;          // IPM identifier (e.g. IPM-BRK-00127)
  status:      BrokerStatus;
  country:     string;
  role?:       string;
  number?:     string;
  zipCode?:    string;
  street?:     string;
  state?:      string;
  city?:       string;
  idType?:     string;
}

export interface BrokerSearchFilters {
  partyType?:    BrokerPartyType;
  legalName?:    string;
  firstName?:    string;
  lastName?:     string;
  country?:      string;
  role?:         string;
  number?:       string;
  zipCode?:      string;
  street?:       string;
  state?:        string;
  city?:         string;
  idType?:       string;
  idValue?:      string;
}
