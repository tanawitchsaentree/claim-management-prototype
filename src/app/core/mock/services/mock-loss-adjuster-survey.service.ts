import { Injectable, WritableSignal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { LossAdjusterSurvey } from '../../models/loss-adjuster-survey.model';
import rawData from '../data/loss-adjuster-surveys.json';

@Injectable({ providedIn: 'root' })
export class MockLossAdjusterSurveyService extends MockBaseService {
  private readonly raw = rawData as unknown as LossAdjusterSurvey[];
  private readonly store: WritableSignal<LossAdjusterSurvey[]> = signal(structuredClone(this.raw));

  getByAssignmentId(assignmentId: string): Observable<LossAdjusterSurvey | null> {
    const found = this.store().find(s => s.assignmentId === assignmentId) ?? null;
    return this.respond(found ? structuredClone(found) : null);
  }

  submit(assignmentId: string, claimId: string, rating: number, comments: string): Observable<LossAdjusterSurvey> {
    const survey: LossAdjusterSurvey = {
      surveyId: `LAS-${Date.now()}`,
      assignmentId,
      claimId,
      rating,
      comments,
      status: 'submitted',
      submittedBy: 'Current User',
      submittedAt: new Date().toISOString(),
    };
    this.store.set([...this.store().filter(s => s.assignmentId !== assignmentId), survey]);
    return this.respond(structuredClone(survey));
  }
}
