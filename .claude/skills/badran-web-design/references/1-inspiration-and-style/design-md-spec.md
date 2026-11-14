# DESIGN.md — the project's single source of visual truth

Every project built with this skill gets a `DESIGN.md` at its root **before any UI code is written**.
Format: Google Stitch's DESIGN.md spec, as used by every file in `design-md/`.
`AGENTS.md`/`CLAUDE.md` says *how to build*; `DESIGN.md` says *how it looks and feels*.

## Structure

1. **YAML front matter** (machine-readable tokens):

```yaml
---
version: alpha
name: <project>-design
description: "<one paragraph: canvas, ink, the one accent and its job, type family, overall mood>"
colors:        # role-named, never hue-named (primary, canvas, ink, ink-muted, hairline, surface-1, semantic-*)
  primary: "#..."
  on-primary: "#..."
typography:    # named roles: display-*, headline, title, body, body-sm, caption, button, numeric
  body:
    fontFamily: ...
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
rounded:       # radius scale: xs sm md lg pill full
spacing:       # 4px-based scale: xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section 96
components:    # each component = references to tokens, e.g. "{colors.primary}", "{rounded.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
---
```

2. **Prose sections, in this order** (same headings as the collection):

| Section | What to write |
|---|---|
| `## Overview` | Mood in 3–5 sentences: who uses it, in what context, what it must feel like |
| `## Colors` | Brand & Accent · Surface · Text · Semantic — each token with its *job* ("primary: only for the single main action per view") |
| `## Typography` | Font Family (+ Arabic family and fallback) · Hierarchy table · Principles |
| `## Layout` | Spacing system · Grid & container widths · Whitespace philosophy · density level |
| `## Elevation & Depth` | Which surfaces float, shadow recipes, when borders instead of shadows |
| `## Shapes` | Radius scale and which component uses which (concentric rule) |
| `## Components` | Buttons, inputs, cards, tables, badges, nav, empty states… with states (hover, focus, active, disabled, loading) |
| `## Do's and Don'ts` | Concrete, checkable rules |
| `## Responsive Behavior` | Breakpoints, touch targets, what collapses and how |
| `## Iteration Guide` | How to extend the system without breaking it |
| `## Known Gaps` | What is not decided yet |

## Rules for writing tokens

- Name colors by **role**, not hue (`danger`, not `red-500`). One accent carries action; semantic colors carry status only.
- Every text/background pair used must pass WCAG AA (4.5:1 body, 3:1 large text & UI glyphs). State the ratio for the main pairs.
- Use a 4px spacing base; never invent one-off values in code — add a token or reuse one.
- Radius by hierarchy, not one radius everywhere: outer = inner + padding.
- Include **dark mode** tokens when the product needs it (same role names, second set).
- Keep it honest: if a value was borrowed from a reference, say so in Overview ("type roles adapted from airtable/DESIGN.md").

## Implementation

Tokens become CSS custom properties (and Tailwind `@theme` variables) **with the same names**:
`--color-primary`, `--color-ink-muted`, `--radius-md`, `--space-lg`, `--font-body`. Components use only tokens.
