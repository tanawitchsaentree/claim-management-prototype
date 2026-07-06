export type StagePage = 'overview' | 'sections' | 'fnol-loss-info';

export type ClosureReason = 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';

export type PostLandHook =
  | { kind: 'overview.openClosureModal' }
  | { kind: 'overview.confirmClosure'; reason: ClosureReason }
  | { kind: 'fnol-loss-info.prefillDuplicate'; date: string; causes: string[] }
  | { kind: 'fnol-loss-info.openShowAllDuplicates'; date: string; causes: string[] }
  | { kind: 'fnol-loss-info.openLocationPicker' }
  | { kind: 'fnol-loss-info.selectCwbMode' }
  | { kind: 'fnol-loss-info.openCwbModal' }
  | { kind: 'fnol-loss-info.prefillCwbCountry'; country: string }
  | { kind: 'fnol-loss-info.runCwbSearch' }
  | { kind: 'fnol-loss-info.selectCwbRow'; cwbReference: string }
  | { kind: 'fnol-loss-info.injectCwbAsLoss'; cwbReference: string };

export interface OverviewStage {
  readonly page: 'overview';
  readonly claimId?: string;
  openClosureModalAuto(): Promise<void>;
  confirmClosure(reason: ClosureReason): Promise<void>;
}

export interface FnolLossInfoStage {
  readonly page: 'fnol-loss-info';
  readonly claimId?: string;
  prefillDuplicate(date: string, causes: string[]): Promise<void>;
  openShowAllDuplicates(date: string, causes: string[]): Promise<void>;
  openLocationPicker(): Promise<void>;
  selectCwbMode(): Promise<void>;
  openCwbModal(): Promise<void>;
  prefillCwbCountry(country: string): Promise<void>;
  runCwbSearch(): Promise<void>;
  selectCwbRow(cwbReference: string): Promise<void>;
  injectCwbAsLoss(cwbReference: string): Promise<void>;
}

export type Stage = OverviewStage | FnolLossInfoStage;
