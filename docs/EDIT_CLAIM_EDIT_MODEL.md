# Edit claim details: per-row Edit or one card-level Edit?

Decision record, 2026-10-13. History: five per-row Edit buttons until `ca3cda8` (2026-10-06), then one card-level Edit. The single Update button and the Discard footer were the same in both.

## The question from the handler's seat

The cause of loss starts the chain (cause -> entities and coverage -> sections). Cause, Incident circumstance, Type of damage, Date of occurrence and Loss location are therefore **not independent fields**: they feed the same coverage check, and Incident circumstance is filtered by the cause. The other fields (description, notification date and time, time of occurrence) are independent.

## Click by click

| Task | Per-row Edit | One card-level Edit |
|---|---|---|
| Fix a typo in the description | Edit on that row, type, Update, confirm. 4 clicks, only that row is live | Edit, find the row, type, Update, confirm. 4 clicks, but every field is live and could be touched by accident |
| Correct the cause after investigation | Edit cause. Circumstance silently becomes empty, a *second* Edit is needed to pick a new one, and the handler can Update with the circumstance still empty | Edit. Cause and the narrowed circumstance list are both open, so the dependent field is visible and fixed in the same pass. 1 commit |
| Change cause + type of damage + location together | 3 Edits, then one Update. Easy to forget one | 1 Edit, 1 Update |
| Just look | No risk | No risk |

## Decision

**Keep the one card-level Edit. Do not go back to per-row.**
Reason: the fields that matter most are interdependent and must be committed together so the consequence is worked out once. Per-row Edit makes half-finished states easy (cause changed, circumstance empty).

Its weaknesses were real, and this change fixes them:

1. **Nothing said which fields matter.** Now an info note while editing: Cause of loss, Type of damage and Loss location decide coverage, and open sections will be marked "Review needed".
2. **Confirm before saving did not say the consequence.** Now it names the fields and says the open sections will be marked.
3. **The warning vanished.** "Stay on this page" left no trace anywhere. Now every open section gets a persistent **Review needed** mark (shown in the Coverage review column of the section row, with the changed fields in its tooltip) until a handler chooses **Mark as reviewed** (asks first, then toasts). The post-save prompt appears only when there is at least one open section to review, with "Later" / "Review sections".
4. **Copies of the facts went stale.** Edit now also updates the claim record (cause keys, loss date, description, location) and the overview location, and a change to the 2nd or later location now counts as a change.

## Not done, and why

- **Recomputing entities and coverage from the new cause.** The calculation lives in a backend that is not in this repo, and the prototype's entity list is a fixed file per policy. Until that exists, the review mark is the honest substitute.
- **Mapping which section a change affects.** There is no rule connecting cause or location to a specific section, so all open sections are marked.
- **Splitting the card into "affects coverage" and "details".** Worth trying later if handlers find the full open form noisy; it would keep one commit per group.
