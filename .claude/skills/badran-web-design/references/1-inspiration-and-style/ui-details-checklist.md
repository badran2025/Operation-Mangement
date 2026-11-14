# UI details checklist (run before calling any screen done)

Condensed from Vercel's Web Interface Guidelines (MIT, full: `vendor/vercel-web-interface-guidelines/command.md`)
and Jakub Krehel's *make-interfaces-feel-better* (MIT, full: `vendor/make-interfaces-feel-better/`).

## Accessibility & focus
- Semantic elements first: `<button>` for actions, `<a>` for navigation, `<label>` for every input, `<table>` for tables.
- Icon-only buttons need `aria-label`; decorative icons `aria-hidden`. Async messages `aria-live="polite"`.
- Visible `:focus-visible` ring on everything interactive; never remove outline without a replacement.
- Hit areas ≥ 44×44 on touch, ≥ 40×40 in dense desktop UI (extend with a pseudo-element).

## Forms
- Correct `type`/`inputmode`/`autocomplete`; never block paste; labels clickable.
- Submit stays enabled until the request starts, then shows progress ("جاري الحفظ…").
- Errors inline beside the field, focus the first error; **keep what the user typed** on error.
- Destructive actions: confirmation or undo — never immediate.

## Typography & numbers
- `font-variant-numeric: tabular-nums` on counts, money, tables, KPIs.
- `text-wrap: balance` on headings, `pretty` on paragraphs. Real ellipsis `…`.
- Long content: `min-w-0` on flex children + `truncate`/`line-clamp`; plan for very short and very long values.

## Surfaces
- **Concentric radius**: outer = inner + padding. Radius follows hierarchy.
- Shadows for elevation, borders for structure/state. Layered, low-opacity shadows.
- Images get a 1px outline at 10% black (light) / 10% white (dark).
- Optical alignment beats geometric (icons in buttons, play glyphs).

## Icons
- One icon library per surface; stroke matches text weight (1.5px with 400, 2px with 600).
- `currentColor`, states via CSS; outline by default, filled = active.

## State coverage (every data view)
Loading (skeleton) · Empty (explain + one action) · Error (what happened + how to fix) · Partial · Long content · No permission.

## Navigation & state
- Filters, tabs, pagination live in the URL. Links are real links (middle-click works).

## Motion (details in part 3)
- Respect `prefers-reduced-motion`. Animate `transform`/`opacity` only; never `transition: all`.
- No animation on high-frequency interactions; press feedback `scale(0.96)`; exits softer than enters.

## Locale
- `Intl.DateTimeFormat` / `Intl.NumberFormat` with explicit time zone; `translate="no"` on brand names/codes.
- Theme: `color-scheme`, `<meta name="theme-color">` matching the canvas.

## Review output
When asked to review, report `file:line — issue` grouped by file, highest impact first, max 15 findings.
