---
version: alpha
name: kleen-ops-fresh-fold
description: "Fresh Fold — a soft, roomy operations UI for Kleen laundries. Cool off-white canvas (#f4f7fb), white surfaces separated by tone not borders, deep navy ink, one action color: Kleen blue (#1f7fc0). Kleen yellow (#ffc531) appears only on today's date chip and the brand mark. Work Sans for English, Firjar for Arabic, generous radius (12–20px), pill buttons, big friendly numbers. Bilingual (English default, Arabic RTL) with light (default) and dark themes."
colors:
  primary: "#1f7fc0"
  primary-hover: "#196ca4"
  on-primary: "#ffffff"
  brand: "#1f8bd0"
  brand-accent: "#ffc531"
  canvas: "#f4f7fb"
  surface: "#ffffff"
  surface-tint: "#e7f1fb"
  surface-sunken: "#eef3f9"
  ink: "#1b2235"
  ink-muted: "#5d6683"
  hairline: "#e3e8f1"
  focus: "#1f7fc0"
  success: "#17713f"
  success-soft: "#e9f6ef"
  warning: "#8a5a00"
  warning-soft: "#fff4d4"
  danger: "#b42318"
  danger-soft: "#fdecec"
  info: "#155f97"
  info-soft: "#e7f1fb"
  dark-canvas: "#121726"
  dark-surface: "#1a2033"
  dark-surface-tint: "#1f2a44"
  dark-surface-sunken: "#161b2c"
  dark-ink: "#e8ecf6"
  dark-ink-muted: "#a3abc4"
  dark-hairline: "#2a3149"
  dark-primary: "#4aa3e6"
  dark-on-primary: "#0b1422"
typography:
  display:  { fontFamily: "Work Sans / Firjar", fontSize: 30px, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0px }
  headline: { fontFamily: "Work Sans / Firjar", fontSize: 22px, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0px }
  title:    { fontFamily: "Work Sans / Firjar", fontSize: 17px, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0px }
  body:     { fontFamily: "Work Sans / Firjar", fontSize: 15px, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0px }
  body-sm:  { fontFamily: "Work Sans / Firjar", fontSize: 13px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0px }
  label:    { fontFamily: "Work Sans / Firjar", fontSize: 13px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0px }
  button:   { fontFamily: "Work Sans / Firjar", fontSize: 14px, fontWeight: 600, lineHeight: 1, letterSpacing: 0px }
  numeric:  { fontFamily: "Work Sans", fontSize: 34px, fontWeight: 600, lineHeight: 1, fontFeature: tnum }
rounded: { sm: 8px, md: 12px, lg: 16px, xl: 20px, pill: 9999px }
spacing: { xxs: 4px, xs: 8px, sm: 12px, md: 16px, lg: 24px, xl: 32px, xxl: 48px }
components:
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button}", rounded: "{rounded.pill}", height: 40px, padding: 0 18px }
  button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.hairline}", rounded: "{rounded.pill}", height: 40px }
  button-ghost:     { backgroundColor: transparent, textColor: "{colors.ink-muted}", hover: "{colors.surface-sunken}", rounded: "{rounded.pill}" }
  input:            { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.md}", height: 40px, padding: 0 12px }
  card:             { backgroundColor: "{colors.surface}", rounded: "{rounded.xl}", padding: "{spacing.lg}", shadow: none }
  kpi:              { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}", padding: 18px, value: "{typography.numeric}" }
  row-soft:         { backgroundColor: "{colors.canvas}", hover: "{colors.surface-sunken}", rounded: 14px, padding: 12px 14px }
  badge:            { typography: "{typography.label}", rounded: "{rounded.pill}", padding: 3px 10px }
  segmented:        { track: "{colors.canvas}", selected: "{colors.primary}", rounded: "{rounded.pill}" }
---

## Overview
Kleen Ops is used every day by an operations manager on a desktop and by branch supervisors and technicians on phones inside hot, bright laundries. It must feel **calm, clean and quick to read** — like freshly folded linen: soft surfaces, generous space, nothing shouting except what is late.
Direction: *Fresh Fold*, adapted from `mercury/DESIGN.md` (tonal elevation instead of borders, soft canvas, light weights, one solid action per group). Colors are Kleen's own: blue word-mark, yellow underline.

## Colors
### Brand & Accent
- **primary `#1f7fc0`** — the single main action per view (New ticket, Save), selected tab, focus ring, links.
- **brand-accent `#ffc531`** — only the brand mark underline and today's date chip. Never for buttons or status.
### Surface
- canvas `#f4f7fb` (cool, never cream) → surface `#ffffff` for cards/panels → surface-sunken `#eef3f9` for rows inside cards and hovers. Elevation is tonal: **no drop shadows on cards**, hairlines only for inputs, tables and dividers.
- surface-tint `#e7f1fb` highlights the first KPI and the active nav item.
### Text
- ink `#1b2235` (AA 14.6:1 on canvas), ink-muted `#5d6683` (AA 5.6:1 on canvas, 6.1:1 on white).
### Semantic (text on its soft background, both AA)
- danger `#b42318` / `#fdecec` — overdue, branch stopped, errors.
- warning `#8a5a00` / `#fff4d4` — waiting for parts, documents expiring ≤ 90 days.
- success `#17713f` / `#e9f6ef` — resolved, all clear.
- info `#155f97` / `#e7f1fb` — assigned, neutral information.
### Dark mode
Same roles: canvas `#121726`, surface `#1a2033`, sunken `#161b2c`, tint `#1f2a44`, ink `#e8ecf6`, muted `#a3abc4`, hairline `#2a3149`, primary `#4aa3e6` with dark text `#0b1422`. Semantic soft backgrounds become deep tints (`#3d1a20`, `#3a2f12`, `#173528`, `#1f3352`) with light text (`#ff9b8f`, `#ffd666`, `#7fd9a6`, `#9ccdf5`).

## Typography
### Font Family
- **English: Work Sans** (variable 250–900, OFL). **Arabic: Firjar** (variable weight 100–800, width pinned to normal, OFL).
- One stack for both languages: `"Work Sans", "Firjar", system-ui` — Firjar is subset to Arabic code points only, so Arabic letters always render in Firjar and Latin letters, digits and punctuation always in Work Sans, in either UI language. Mixed names ("Md Arafat" in an Arabic page) stay correct.
### Hierarchy
display 30/600 · headline 22/600 · title 17/600 · body 15/400 · body-sm 13/400 · label 13/500 · button 14/600 · numeric 34/600 tabular.
### Principles
- Arabic gets +0.1 line-height (`:lang(ar)` → body 1.7). Never letter-space Arabic. No all-caps in English either (labels are sentence case).
- Digits: Latin digits in both languages (fast scanning, matches data). Always `tabular-nums` for counts and tables.
- Weights stay between 400 and 600; 700 only for the brand word.

## Layout
### Spacing System
4px base: 4 · 8 · 12 · 16 · 24 · 32 · 48. Page padding 28px desktop / 16px mobile. Gap between blocks 24px (20px mobile).
### Grid & Container
Desktop: start-side sidebar 248px + content max 1320px. Dashboard body: 1.35fr (branches) + 1fr (tickets, documents). < 1100px single column. < 820px: sidebar becomes a fixed bottom nav (4 items + safe-area).
### Whitespace Philosophy
Roomy, but data stays scannable: rows 44–48px tall, never cramped; one idea per card.

## Elevation & Depth
Tonal only: canvas → surface → sunken rows. Overlays (dialogs, sheets, popovers) use `0 12px 32px rgba(27,34,53,.14)` (dark: `rgba(0,0,0,.45)`). Sticky top bar uses 85% canvas + backdrop blur.

## Shapes
sm 8 (chips, small inputs) · md 12 (inputs, menu items) · lg 16 (KPI tiles) · xl 20 (cards/panels) · pill (buttons, badges, segmented controls). Rows inside a 20px card use 14px (concentric: 20 − 6 padding).

## Components
- **Buttons** — primary pill (one per group), secondary pill with hairline, ghost pill for toolbars. Press: scale(.97). Loading: spinner + disabled, label stays.
- **KPI tile** — value above label (numeric style), first tile on tint; overdue value in danger, expiring documents in warning.
- **City segmented control** — pill track on canvas, selected = primary fill; counts inside each segment.
- **Branch row** — soft row: name (600) · working count · status pill (danger "N overdue" or success "All clear") · chevron (mirrored in RTL).
- **Ticket row** — soft row: title (own text direction, truncates at its end), status badge, then meta line: branch, technician, due time (danger when late).
- **Badges** — soft semantic background + text; never color alone (always words).
- **Tables** (lists of workers, documents) — hairline rows on surface, sticky header, numbers tabular, horizontal scroll on mobile.
- **Inputs** — 40px, 12px radius, hairline, focus ring 2px primary with 2px offset.
- **Empty state** — short title, one sentence, one primary action.
- **Top bar** — search (start), language switch (shows the *other* language name), theme switch (icon), avatar.

## Do's and Don'ts
### Do
- One solid primary button per group; everything else secondary or ghost.
- Separate surfaces by tone; let overdue/stopped be the only loud things on a page.
- Translate every UI string; keep user-entered data as written, with `dir="auto"`.
- Use logical CSS only (start/end, ms/me, ps/pe) so the same component works in both directions.
### Don't
- Don't use yellow for status or buttons.
- Don't add drop shadows to cards or gradients to backgrounds.
- Don't use middle-dot meta strings, arrow-suffixed links, or numbered markers on non-sequences.
- Don't animate filters, tabs or anything used dozens of times a day beyond a ≤150ms color change.

## Responsive Behavior
### Breakpoints
≥1100 two columns · 820–1099 one column with sidebar · <820 bottom nav, KPIs 2-up (first full width), segmented controls scroll horizontally.
### Touch Targets
≥ 44×44px on mobile (bottom nav items, row chevrons, icon buttons).
### Collapsing Strategy
Tables keep columns and scroll horizontally; meta lines wrap; secondary meta hides first on small screens.

## Iteration Guide
New screens reuse: card (xl) → soft rows (14px) → badges/pills. New status = one of the four semantic pairs, never a new hue. New tokens go into this file first, then `globals.css`.

## Known Gaps
- Brand colors are estimated from the logo; replace with official values when available.
- Charts are not designed yet (when needed: primary + muted ink + semantic colors only).
