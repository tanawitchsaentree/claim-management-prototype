import { ArrivalContext, ArrivalCriterion } from '../models/arrival-context.model';
import { DevTicket, TicketAC } from '../models/dev-ticket.model';
import { TicketWithDetails } from '../models/tracker.model';
import { TourStep, toTourStep } from './tour.service';

// Pure derivation, no injectables — a tracker link's destination screen has to
// explain itself, and every word of that explanation already exists somewhere in
// the data. Two sources, either of which may be missing:
//
//   DevTicket (public/tickets/<id>.json)  — acceptance criteria, expected UI,
//                                           visual cues, how-to-test, walkthrough
//   TicketWithDetails (tracker row)       — Jira key/url, title, build + handoff
//                                           status, blocker and its note
//
// Measured on 2026-09-02: of the 30 tracker rows with a clickable route, 8 have a
// matching ticket file and 22 have nothing but the row. Both cases must produce a
// usable panel — the 22 get "here is the screen, and here is the honest statement
// that no criteria were recorded", which is still infinitely better than landing
// on an unexplained page. What this must never do is invent orientation text.

function toCriterion(ac: TicketAC): ArrivalCriterion {
  return {
    id: ac.id,
    statement: ac.plainStatement ?? ac.statement,
    buildStatus: ac.buildStatus,
    expected: ac.expectedUI.description,
    visualCues: ac.expectedUI.visualCues,
    trigger: ac.howToTest.trigger,
    expectedResult: ac.howToTest.expectedResult,
  };
}

export function buildArrivalContext(input: {
  route: string;
  ticket: DevTicket | null;
  row: TicketWithDetails | null;
  jiraKey: string | null;
}): ArrivalContext {
  const { route, ticket, row } = input;
  const authored = ticket?.walkthroughSteps.length ?? 0;
  const generated = ticket ? buildFallbackTour(ticket).length : 0;

  return {
    jiraKey: row?.jiraKey ?? input.jiraKey,
    jiraUrl: row?.jiraUrl ?? null,
    ticketId: ticket?.ticketId ?? null,
    // The tracker row's title is the one the reviewer just read in the table, so
    // it wins over the ticket file's — landing on a differently-worded heading
    // than the row you clicked reads as having opened the wrong thing.
    title: row?.title.trim() ?? ticket?.title ?? 'This screen',
    module: ticket?.module ?? row?.epic?.title ?? null,
    route,
    buildStatus: row?.state.buildStatus ?? null,
    handoffStatus: row?.state.handoffStatus ?? null,
    blockedBy: row?.state.blockedBy && row.state.blockedBy !== 'none' ? row.state.blockedBy : null,
    blockedNote: row?.state.blockedNote ?? null,
    criteria: (ticket?.acceptanceCriteria ?? []).map(toCriterion),
    tourStepCount: authored || generated,
    tourIsGenerated: authored === 0 && generated > 0,
  };
}

// A ticket with acceptance criteria but no authored walkthroughSteps still has
// everything a tour needs — it's just phrased as assertions instead of as
// narration. This rewrites the assertions into steps rather than leaving those
// tickets tour-less.
//
// Measured 2026-09-02: all 24 current ticket files DO have walkthroughSteps, so
// this path fires for none of them today — it exists so that adding a ticket file
// without hand-writing a walkthrough yields a usable tour instead of a silently
// missing one. scripts/audit-prototype-links.mjs asserts every ticket file
// resolves to a non-empty tour through one path or the other, which is the
// invariant that actually matters; if that audit ever passes only because of this
// function, the function is doing its job.
//
// Untargeted on purpose: `targetId` has to match a `data-tour-id` attribute that
// somebody put in a template by hand, and the AC data carries no such reference.
// Guessing one would point the highlight ring at the wrong element or at nothing,
// so these render as the renderer's centered narrative cards. An authored
// walkthrough, which CAN name targets, always wins — see the callers.
export function buildFallbackTour(ticket: DevTicket): TourStep[] {
  const criteria = ticket.acceptanceCriteria.filter((ac) => ac.buildStatus !== 'todo');
  if (!criteria.length) return [];

  const opening: TourStep = {
    title: ticket.title,
    body:
      `${criteria.length} acceptance ${criteria.length === 1 ? 'criterion' : 'criteria'} to check on this screen. `
      + `This walkthrough is generated from them — nobody wrote it by hand, so it describes what the criteria assert, not every detail of the screen.`,
  };

  const steps = criteria.map((ac, i): TourStep => {
    const cues = ac.expectedUI.visualCues.length
      ? ` Look for: ${ac.expectedUI.visualCues.join('; ')}.`
      : '';
    return {
      title: `${i + 1}. ${ac.id}${ac.buildStatus === 'partial' ? ' (partially built)' : ''}`,
      body: `${ac.plainStatement ?? ac.statement}\n\n${ac.expectedUI.description}${cues}\n\nTry: ${ac.howToTest.trigger}`,
      expectedAfterClick: ac.howToTest.expectedResult,
      route: ac.howToTest.route,
    };
  });

  return [opening, ...steps];
}

/** Authored walkthrough if there is one, otherwise the generated one. */
export function resolveTourSteps(ticket: DevTicket): TourStep[] {
  if (ticket.walkthroughSteps.length) return ticket.walkthroughSteps.map(toTourStep);
  return buildFallbackTour(ticket);
}
