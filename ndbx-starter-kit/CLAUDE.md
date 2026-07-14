# NDBX Starter Kit — Claude Instructions

## Read first

Before writing any code, read:
1. `.claude/CONTEXT.md` — stack, token traps, NDBX gotchas, forbidden patterns
2. `.claude/BLESSED.md` — verified patterns to copy from
3. `docs/NDBX_RECIPES.md` — verified HTML snippets for every NDBX component

## Before any UI / SCSS task

Answer these before writing code:
1. Does an NDBX component exist for this element? (check `docs/NDBX_RECIPES.md`)
2. Does a blessed pattern exist? (check `.claude/BLESSED.md`)
3. Which design tokens apply? (grep `ndbx.css` — never hardcode hex)
4. Is `nx-formfield` the right wrapper, or will it cause a spacing gap? (see `.claude/skills/nx-formfield-spacing-trap/SKILL.md`)

## Skills

`.claude/skills/` contains targeted skill files for specific traps. Claude Code auto-discovers them. Use them when the trigger condition matches — do not skip.

## Critical token traps (memorise these)

- `--text-02` is WHITE — invisible on white backgrounds. Use `--text-01` or `--text-muted`
- `NxExpertModule` overrides `--interactive-primary` and `--text-02` at runtime — re-assert in `styles.scss :root`
- `[nxLayout]` writes inline padding on its host — wrap with outer div before adding `padding-top`
- Every `<nx-radio>` MUST have `labelSize="small"`
- Never use `appearance="outline"` on `nx-formfield` — `expert.css` is not loaded

## Forbidden

- `subscribe()` in component class
- `: any`
- Hardcoded hex/rgb in component scss
- `nx-formfield appearance="outline"`
- Native `<select>`, `<input type="date">`, raw `<input>` outside formfield
- `font-size` below 14px on readable text

## Definition of done

Before declaring any UI task complete:
- [ ] Renders correctly in browser
- [ ] Zero console errors
- [ ] All interactions work
- [ ] No hardcoded hex/rgb in scss
- [ ] No forbidden patterns
