# Ticket source audit, 2026-11-17

Question: which tickets did the prototype make things up for?
Method: every ticket in public/tickets compared with the real Jira text (pulled 2026-11-17), the Confluence pages Jira points to, and the built screens.
Buckets: Made up (on screen, no source), Contradicts (built differently from the source), Decided (source leaves it open, prototype picked).
Flags: (D) written as "Decision" in the ticket JSON, (AD) tagged [accepted-deviation], (unflagged) not marked anywhere.

## Significant

### BMPCC-11006 Orphan conversion
- Made up: "Extend SLA", "Abandon claim" and the SLA countdown column (step-1-search.component.html:234,273-281). Converted orphan can't close without a section and reserve (claim-closure-blocker.builder.ts:29-43), unflagged.
- Contradicts: Confluence 3008228060 says create an incident record, complete FNOL, call CloseSkeletonClaim; prototype updates the same record and skips FNOL. Jira: only Date and Time of loss mandatory; prototype also requires client name and reason. Confluence: link to customer or policy; prototype policy only. Ticket JSON still describes "Convert to claim" and a "needs setup" banner that no longer exist.
- Decided: policy eligibility rules "Different client", "Loss date outside policy period".

### BMPCC-11360 Closure and retention
- Made up: 6 required reopen reasons (spec: optional, list not received). Confirm line "Provider Management survey is completed, or rejected" with no source. Checklist rows "Recovery potential answered" / "Recovery case set up" come from descoped BMPCC-17779.
- Contradicts: closure date and reason stay visible after reopen (spec 3055659701: hidden). 2 closure reasons instead of Jira's 3 (Claim Rejected missing), not marked.
- Decided: Close Claim button placement (Jira: "UI TBD with UX team"). Custom retention date built although struck through "(TBD)" in Jira.

### BMPCC-12160 Party role
- Contradicts: Jira "only single Claim role"; prototype allows several (edit-role-dialog). Role list differs (Jira: Claimant, Claims Third Party, Lawyer, Loss Adjuster, Other). Default parties editable (Jira: not allowed). Reference Number column missing. Ticket says done.

### BMPCC-14452 Loss adjuster rating
- Contradicts: Jira maps fields from the "Loss Adjuster Rating (Lead) (FINAL)" form; built as one star rating + comment.
- Decided: quiet tertiary button (Jira: "visible enough to ensure completion"). ">100k" target dropped.

### BMPCC-14453 Document attachment
- Jira: To Do, unassigned. Built anyway in e21c7a4 (breaks RULE -2).
- Made up: Internal/External provider badge, "Additional instructions" field, "Send Communication via Email" in the title.
- Contradicts: no review step before sending (Jira asks for one). Ticket says done.
- Decided: file types and 10 MB limit (Jira: to be defined in BMPCC-14448).

### BMPCC-14831 Financial overview
- Contradicts: Jira wants Transaction Summary on top and the rest collapsed; built with Financial details first and expanded. Payments, Reserves, Recoveries are separate views, not accordions. No pagination; only the Transaction Summary gap is (AD).

### BMPCC-16104 Reopen
- Made up: optional Note box (spec §12: "should not be built"). Reason lists (spec Q3: none received). A third confirm step.
- Contradicts: closure date and reason still shown after reopen. Toast instead of the info banner the spec asks for. No Loss Event reopened banner. Bug: reopen logs "Rejection approval: Requested → Declined" (claim-overview.component.ts:588-597).
- Decided: reason mandatory (Jira mandatory, spec optional), not flagged.

### BMPCC-17678 Approvals QA
- Ticket JSON describes Approve/Reject/View details menus. Real Jira is spacing and alignment fixes A to G (32px gap, remove grey bar, remove policy currency). None of them are in the ticket JSON.

### BMPCC-17779 Recovery flag (Descoped in Jira)
- Ticket JSON never says Descoped and marks all 10 ACs done.
- Made up, unflagged: required reason on No, warning + accent border when unanswered, dashboard "decision needed" panel, the whole Recoveries page with Recovered / Written off.
- Decided: Yes without a case hard-blocks closure. The real rule ("X+ days → task") isn't built.

### BMPCC-19113 Skeleton conversion
- Made up: cause of loss guessed from text, location keep/change rules, Coverages step, "Awaiting policy" chip and filter, loss event ID, insured and broker added automatically.
- Contradicts: Jira says run the FNOL flow capturing claim details, parties, reserves; built as a Link-policy sheet on Claim Overview.
- Nothing flagged.

### BMPCC-219 Date attribute
- Ticket JSON is titled "Loss Location via CWB MFE" and all 5 ACs are about CWB location search. The real Jira ACs (dates propagate to E&D, Date of Loss ≤ Date of Notification, on hold) are missing.

### BMPCC-241 Orphan creation
- Jira has no description. Every AC (Broker/Insured only, 3 steps, GIS search, Go to dashboard, parties optional) has no Jira source.

### BMPCC-22395 Claims Manager dashboard
- Made up: Team queue row (D), "(Out of office until…)" (unflagged), lists capped at 8 rows (unflagged), default sort most flags first (D), Reassign in the row menu (Jira: out of scope unless business confirms) (AD).
- Decided: High value 250,000 (AD), stale after 15 minutes (D), team = direct reports (D), summary counts and row fields (D).

### BMPCC-22665 Impacted policies
- Made up: FNOL reserves only on the first policy (D).
- Contradicts: Confluence 3341441184 §2.4 creates claims on Next of Entities & Damages; prototype creates them on Summary Submit (unflagged). §2.2 impacted policies come from the same customer; prototype allows another client's policies (D).
- Decided: step position, only searched policy ticked, shared loss information, per-policy failure (D).

### BMPCC-22666 Manual reassignment
- Made up: authority limit 500,000 (AD), out-of-office greyed out (unflagged), "Keep it myself", reason field into activity log, team-queue move notifies the manager (unflagged), KCM can reassign anything (D).
- Decided: eligibility and bulk reassignment (Jira: confirm with PO) (D). Take claim only within own team (D).

## Minor

- BMPCC-14434 Section closure: section-level reasons invented. Close Claim always clickable (Jira: only when all sections closed); 14434 and 11360 ticket files disagree.
- BMPCC-14435 Cross-domain checks: "Go to" links and euro totals added; AC-02 says no link but there is one.
- BMPCC-14437 Closure on last payment: "Simulate final payment" sits in the real section menu. Automatic claim closure only checks open tasks, not the other blockers Jira lists.
- BMPCC-16986 Mass event: "Confirm link" action not in Jira; popover placement decided.
- BMPCC-18492 CBI on Edit claim: utility type list, "Review needed" rule on CBI change, "Claim description" rename; no Figma.
- BMPCC-216 Duplicate check: "Show all N" modal and new-tab links unflagged; cause+date trigger is (AD).
- BMPCC-7133 Limits/deductibles: Party, Damage, Applicable to, Recoverable columns from Jira are missing.
- BMPCC-22328 Sections: closed claim blocks selection, shared Close/Reopen bar, "Same as claim / different date" (D); entity date defaults (unflagged).
- BMPCC-22350 Heads-Up: confirm on Save draft (unflagged); reason definitions and all 8 open questions answered in HU-1 (D).
- BMPCC-22635 FNOL acknowledgement: bell line and letter preview (unflagged); "Nothing is sent" may contradict Confluence 2940829713 "Delivery Channel: Email".
- BMPCC-22660 Bulk closure: "No open tasks" row (unflagged); open-task check added to automatic closure, outside this story's FR2/FR4 scope.
- BMPCC-22661 GG booking: "on hold" wording, 2 retries then Finance (D), anyone may retry.

## Tickets with no Jira key

- ready-to-close: made up entirely (demo preset). Also stale.
- closure: partly sourced (epic BMPCC-14434). Disabled button + tooltip contradict BMPCC-16284 and no longer exist; 2 reasons instead of 3.
- close-section: sourced (BMPCC-14629). Button always opens a popup (Jira: disabled until blockers resolved, logged). Blocker list differs; ticket text stale.
- champ-preclosure-checklist: sourced (BMPCC-16284). Fixed 10-row list (Jira: driven by configured domains). Recovery rows have no source.
- champ-impacted-policies: sourced (production + epic BMPCC-22567). "Why it surfaced", Status and Entities columns are ours.
- champ-financial-loss-item: sourced (BMPCC-3212 + production). Built in Sections instead of FNOL E&D; cause made mandatory without source.
- bmpcc-no-loss-location: sourced (BMPCC-16270 AC3), small scope gap.
- gg-1 to gg-8: partly sourced (epic BMPCC-18348 and stories). No source for auto fix tasks, bell notifications, "With Finance" hand-off, "policy team has been told", "Warning only" unpaid-premium option (21754 says prevent), approver sent back / resubmit. Item rows hide GG's error text although 19169 AC-2 says show it.

## Caveat
BMPCC-16270, 16284 and 14618 use the prototype URL as their Figma link, so some Jira text was written from these screens. Agreement with Jira doesn't always prove the requirement came first.
