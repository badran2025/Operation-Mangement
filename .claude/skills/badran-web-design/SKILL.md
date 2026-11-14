---
name: badran-web-design
description: Badran's web design system and workflow for building or redesigning any website, web app, dashboard or landing page. Use when the user says "badran web design", "استخدم مهارة badran web design", or asks to design/redesign/build a site or UI with this skill. Covers choosing a visual direction from 84 real DESIGN.md styles, writing the project's DESIGN.md, building pages piece by piece, motion/icons/illustration, Arabic/RTL rules, and a quality checklist.
---

# Badran Web Design

A design workflow built from 21 curated sources (inspiration & style · UI building · motion & visuals).
The output of every project is: a `DESIGN.md` → tokens in code → pages built from components → a reviewed, polished result.

> Status: **Part 1 (inspiration & style) is complete.** Parts 2 (building UI piece by piece) and 3 (motion, effects, illustrations, icons) are being added — see the sections marked *pending*.

## When invoked — the workflow

1. **Understand the brief.** Product, audience, the main job of each screen, device context (phone in a branch vs desktop), language/direction (Arabic RTL?), light/dark. Ask only what you can't infer.
2. **Gather direction (part 1).** Read `references/1-inspiration-and-style/choosing-direction.md`. Pick 2–3 references from `references/1-inspiration-and-style/style-catalog.md` (open the actual `design-md/<name>/DESIGN.md`), and use `sources.md` to look at Kage / Refero / Minimal Gallery for the specific components needed. Write what you take from each.
3. **Plan, then self-review.** Compact plan (4–6 colors, type roles, layout concept with ASCII wireframe, 3 principles). Check it against the generated-UI defaults list; revise anything generic.
4. **Write `DESIGN.md`** at the project root from `templates/DESIGN.template.md`, following `references/1-inspiration-and-style/design-md-spec.md`. Show the user the direction (a quick preview page or screenshot) **before** rebuilding everything.
5. **Implement tokens** as CSS variables / Tailwind `@theme` with the same names. No raw hex or one-off spacing in components.
6. **Build piece by piece (part 2 — pending).** Use canonical component names from `references/1-inspiration-and-style/component-names.md`. Every data view gets loading / empty / error states.
7. **Motion & visuals (part 3 — pending).** One orchestrated moment max; purposeful micro-interactions only.
8. **Review.** Run `references/1-inspiration-and-style/ui-details-checklist.md`, take screenshots at 1280px and 390px, fix, re-screenshot. Then report what changed and why.

## Non-negotiables
- Real content and real data — never lorem ipsum in a delivered screen.
- Responsive to 360px without horizontal scroll; visible focus; AA contrast; `prefers-reduced-motion`.
- References are direction only: no copied logos, brand names, product copy, or proprietary fonts.
- Arabic/RTL: logical properties, proper Arabic typeface, no letter-spacing on Arabic, mirrored directional icons, LTR spans for numbers/phones/emails.
- Spend boldness in one place; keep everything else calm.

## Map

| Path | Use |
|---|---|
| `references/1-inspiration-and-style/sources.md` | The 7 inspiration sources: what each is for and how to use it |
| `references/1-inspiration-and-style/style-catalog.md` | 84 styles grouped by product type + dashboard shortlist |
| `references/1-inspiration-and-style/choosing-direction.md` | Method to pick a direction + anti-generic rules + Arabic/RTL rules |
| `references/1-inspiration-and-style/design-md-spec.md` | How to write the project's DESIGN.md |
| `references/1-inspiration-and-style/component-names.md` | Canonical component names, aliases, ops-app essentials |
| `references/1-inspiration-and-style/ui-details-checklist.md` | Pre-ship checklist (a11y, forms, typography, surfaces, icons, states) |
| `templates/DESIGN.template.md` | Starting DESIGN.md |
| `design-md/<name>/DESIGN.md` | 84 full style analyses (MIT) |
| `vendor/` | Full original skills: Anthropic frontend-design (Apache-2.0), make-interfaces-feel-better (MIT), Vercel web interface guidelines (MIT) |
| `references/2-building-ui/` | *pending — part 2* |
| `references/3-motion-and-visuals/` | *pending — part 3* |
| `SOURCES.md` | All sources and licenses |
