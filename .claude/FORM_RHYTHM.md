# Form rhythm: spacing for any block of form fields

**Read this before building any new section, accordion body, modal body or card of fields.**
`SPACING.md` covers dashboard widgets only; this file covers forms. `audit:theme` only checks
that values are tokens. It cannot tell you the rhythm is wrong, so a section made entirely of
valid tokens can still look careless (one flat grid `gap` between everything = no hierarchy).

## The law

Proximity encodes relationship. The further up the nesting, the bigger the gap. Never equal,
never smaller.

| Level   | What it is                                                        | Gap  | Mixin (`shared/styles/_form-rhythm.scss`) |
| ------- | ----------------------------------------------------------------- | ---- | ----------------------------------------- |
| field   | a label and the control(s) it names                               | 8    | `fr.field`                                |
| group   | items that belong together (control + error, checkbox + reveal)   | 12   | `fr.group`                                |
| stack   | blocks inside one section                                         | 24   | `fr.stack`                                |
| body    | section to section                                                | 32   | `fr.body`                                 |
| heading | 16 above its content (section gap), 32 below the previous section | 16   | `fr.section`                              |

## How to build

1. Draw the nesting first: sections > blocks > groups > fields. Say it out loud before writing SCSS.
2. One wrapper per level, one mixin per wrapper. Do not use a flat `display: grid; gap` for the whole section.
3. Never add a margin to fix one spot. If a gap looks wrong, the element is in the wrong level.
4. `nx-formfield` reserves ~20px under its input. Add `@include fr.absorb-formfield-reserve` to it
   so the next block sits at the scale gap, not 20px further.
5. Take a screenshot with Playwright (see memory: browser verification) in every state that
   changes the layout (empty, filled, toggled) and check each gap against the table before
   saying it is done. Token audits passing is not evidence.

Reference implementation: `features/claims/make-payment/payee-section/`.
Not yet moved to this rhythm: `method-section`, `amount-section` (still one flat grid gap).
