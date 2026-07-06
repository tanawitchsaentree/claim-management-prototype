import { ApplicationRef, Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom, filter, take, of, timeout, catchError } from 'rxjs';
import {
  PostLandHook,
  Stage,
  StagePage,
  OverviewStage,
  FnolLossInfoStage,
} from './scenario-stage.model';

const STAGE_READY_TIMEOUT_MS = 4000;

// Key includes claimId to prevent collision when two claim views are alive
// simultaneously (e.g. primary claim + reference panel). Format: 'page::claimId'
// for claim-scoped pages, bare 'page' for non-claim pages (fnol-loss-info).
type StageKey = string;

function stageKey(stage: Stage): StageKey {
  if ('claimId' in stage && stage.claimId) return `${stage.page}::${stage.claimId}`;
  return stage.page;
}

@Injectable({ providedIn: 'root' })
export class ScenarioStageService {
  private readonly appRef = inject(ApplicationRef);
  private readonly stages = new Map<StageKey, Stage>();
  private readonly readyEvents$ = new Subject<StageKey>();

  register(stage: Stage): () => void {
    const key = stageKey(stage);
    this.stages.set(key, stage);
    this.readyEvents$.next(key);
    return () => {
      if (this.stages.get(key) === stage) this.stages.delete(key);
    };
  }

  private get(page: StagePage, claimId?: string): Stage | null {
    const key = claimId ? `${page}::${claimId}` : page;
    return this.stages.get(key) ?? null;
  }

  private async waitForStage<T extends Stage>(page: StagePage, claimId?: string): Promise<T | null> {
    const existing = this.get(page, claimId);
    if (existing) return existing as T;
    const key = claimId ? `${page}::${claimId}` : page;
    const ready$ = this.readyEvents$.pipe(
      filter(k => k === key),
      take(1),
      timeout(STAGE_READY_TIMEOUT_MS),
      catchError(() => of(null)),
    );
    const got = await firstValueFrom(ready$);
    if (!got) return null;
    return (this.get(page, claimId) as T) ?? null;
  }

  private async waitForStable(): Promise<void> {
    await firstValueFrom(this.appRef.isStable.pipe(filter(s => s), take(1)));
  }

  async run(hooks: PostLandHook[] | undefined, claimId?: string): Promise<void> {
    if (!hooks?.length) return;
    await this.waitForStable();
    // Settle: let component ngOnInit + ViewChild queries finish.
    await new Promise(resolve => setTimeout(resolve, 50));
    for (const hook of hooks) {
      try {
        await this.execute(hook, claimId);
      } catch (err) {
        console.warn('[ScenarioStage] hook failed:', hook, err);
      }
      // Allow change detection + animation frames between hooks.
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private async execute(hook: PostLandHook, claimId?: string): Promise<void> {
    switch (hook.kind) {
      case 'overview.openClosureModal': {
        const s = await this.waitForStage<OverviewStage>('overview', claimId);
        if (s) await s.openClosureModalAuto();
        return;
      }
      case 'overview.confirmClosure': {
        const s = await this.waitForStage<OverviewStage>('overview', claimId);
        if (s) await s.confirmClosure(hook.reason);
        return;
      }
      case 'fnol-loss-info.prefillDuplicate': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.prefillDuplicate(hook.date, hook.causes);
        return;
      }
      case 'fnol-loss-info.openShowAllDuplicates': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.openShowAllDuplicates(hook.date, hook.causes);
        return;
      }
      case 'fnol-loss-info.openLocationPicker': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.openLocationPicker();
        return;
      }
      case 'fnol-loss-info.selectCwbMode': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.selectCwbMode();
        return;
      }
      case 'fnol-loss-info.openCwbModal': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.openCwbModal();
        return;
      }
      case 'fnol-loss-info.prefillCwbCountry': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.prefillCwbCountry(hook.country);
        return;
      }
      case 'fnol-loss-info.runCwbSearch': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.runCwbSearch();
        return;
      }
      case 'fnol-loss-info.selectCwbRow': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.selectCwbRow(hook.cwbReference);
        return;
      }
      case 'fnol-loss-info.injectCwbAsLoss': {
        const s = await this.waitForStage<FnolLossInfoStage>('fnol-loss-info');
        if (s) await s.injectCwbAsLoss(hook.cwbReference);
        return;
      }
    }
  }
}
