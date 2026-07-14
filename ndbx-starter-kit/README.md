# NDBX Starter Kit for Claude Code

Drop this into any Angular + @allianz/ng-aquila project to give Claude structured context for building UI accurately.

## How to use

1. Copy the entire `ndbx-starter-kit/` folder into your project root
2. Rename: move `.claude/` contents into your project's `.claude/`, and `docs/` into your project's `docs/`
3. Start Claude Code — it will auto-load `.claude/CONTEXT.md` and discover skills under `.claude/skills/`

## What's included

```
.claude/
├── CONTEXT.md                          ← Stack, token traps, NDBX gotchas, forbidden patterns
├── BLESSED.md                          ← Verified HTML+SCSS patterns to copy from
└── skills/
    └── nx-formfield-spacing-trap/
        └── SKILL.md                    ← Fixes oversized gaps from nx-formfield reserved zones
docs/
└── NDBX_RECIPES.md                     ← Verified HTML snippets for every NDBX component
```

## What each file does

| File | When Claude reads it |
|------|---------------------|
| `CONTEXT.md` | Before any code — stack, tokens, component protocol, forbidden patterns |
| `BLESSED.md` | Before writing UI — copy these patterns instead of improvising |
| `NDBX_RECIPES.md` | Before writing any NDBX component — exact verified HTML snippets |
| `skills/nx-formfield-spacing-trap/SKILL.md` | When spacing looks wrong on dense layouts with inputs |

## Adding your own patterns

When Claude builds something and you confirm it works:
1. Add the HTML + SCSS block to `BLESSED.md` under a new heading
2. Update the Variant Registry in any skill file if a new case was encountered

## Stack this was built for

- Angular ^21 standalone (no NgModule)
- `@allianz/ng-aquila` ^21.x (NDBX)
- `@allianz/ngx-brand-kit` ^21.x
- Reactive Forms only
