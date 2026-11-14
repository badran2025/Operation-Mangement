# Choosing a visual direction

Condensed from Anthropic's `frontend-design` skill (full text, Apache-2.0: `vendor/anthropic-frontend-design/SKILL.md`) plus project rules.

## 1. Ground it in the subject
Name the product, its audience, and the screen's **primary job** before choosing anything. Distinctive choices come from the subject's world (a laundry-operations tool ≠ a crypto landing page). If unknown, propose one and confirm with the user.

## 2. Pick 2–3 references, deliberately
- From `style-catalog.md` (dashboards: start with the shortlist), Kage components, Refero styles.
- For each reference write one line: **what you take** (e.g. "airtable: type roles + table density") and **what you leave**.
- Never mix more than one *color language*; you may borrow type from one and layout from another.

## 3. Write a compact plan first (before code)
- **Color**: 4–6 named hex values (canvas, surface, ink, muted ink, one accent, + semantic set).
- **Type**: families and roles. One family is fine; two only if clearly distinct.
- **Layout**: one-sentence concept + ASCII wireframe; alignment (RTL start-aligned by default).
- **Principles**: 3 bullets that make this product's UI recognisable.

Then **review the plan against the brief**: if any part is what you'd produce for *any* similar page, change it and say why. Only then write `DESIGN.md` and code.

## 4. Avoid the generated-UI defaults (unless the brief asks for them)
- Warm cream (#F4F1EA) + serif display + terracotta accent; near-black + one acid accent; newspaper hairlines + zero radius.
- The SaaS card kit: everything in identical rounded cards, same soft grey shadow, gradient washes.
- Template chrome: ALL-CAPS tracked eyebrows over every heading, "A · B · C" meta strings, '→' on every link, mono font for small labels, 01/02/03 markers on non-sequences.
- One accented word in a headline; fade-up on every section; hover animation on every card.

## 5. Restraint
Spend boldness in **one** place. Everything else quiet. Before shipping, remove one accessory.
Quality floor (non-negotiable): responsive to 360px, visible keyboard focus, reduced motion respected, AA contrast, real content.

## 6. Arabic / RTL projects (project-specific rules)
- `<html lang="ar" dir="rtl">`; use **logical CSS** only (`ps-/pe-`, `ms-/me-`, `start/end`, `border-s`) — never left/right.
- Arabic type: pick a family with a real Arabic design and good weights — **IBM Plex Sans Arabic**, **Noto Kufi Arabic**, **Readex Pro**, **Tajawal**, **Cairo** (Cairo is common — prefer it only with a reason). Pair with a Latin family of matching x-height; numbers/emails/phones in `dir="ltr"` spans.
- Arabic needs ~10% more line-height than Latin and no letter-spacing (never track Arabic).
- No ALL-CAPS concept in Arabic — hierarchy must come from size/weight/color.
- Mirror directional icons (arrows, chevrons, back) but **not** clocks, media play, checkmarks, or logos.
- Dates/numbers via `Intl` with the business time zone; decide Latin vs Arabic-Indic digits once in DESIGN.md (ops tools: Latin digits are faster to scan).
- Mixed Arabic/English names in one list: align to start, let each run its own direction.
