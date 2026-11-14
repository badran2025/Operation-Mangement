# Kleen Operations — design directions (badran-web-design, steps 1–3)

## Brief
- **Product:** internal operations site for Kleen laundries — 21 branches in 3 cities, 101 workers, maintenance tickets.
- **Users:** operations manager (desktop, daily, dense work), branch supervisors & technicians (phone, inside a branch, quick checks and reporting).
- **Primary jobs:** (1) see every branch's health at a glance (staff today, open/overdue tickets); (2) move maintenance tickets to closed; (3) manage workers.
- **Constraints:** Arabic (RTL) + English (LTR) with a switch · light + dark mode · real data that mixes Arabic and English (ticket titles are written by staff in either language) · readable on a phone in a hot, bright laundry.
- **Brand cues (from the Kleen logo in the roster PDF):** a clear blue word-mark with a yellow underline. Approximated: blue `#1F8BD0`, yellow `#FFC531` — to confirm with the real brand file.

## References and what we take
| Reference | Take | Leave |
|---|---|---|
| `airtable` | Sober white canvas + dark ink, near-black primary action, link-blue kept for links only, data density, hairlines | Editorial colour cards, marketing pacing |
| `linear.app` | Four-step surface ladder for dark, one accent only for action/focus, quiet hierarchy, compact rows | Near-black-only marketing, proprietary fonts, negative tracking (never on Arabic) |
| `mercury` | Tonal elevation instead of borders, soft light canvas, generous spacing, light weights, one solid button per group | Lavender palette, centred marketing sections |

## Three directions

### A — Ledger (Airtable-led) · dense, factual, desktop-first
- **Color:** canvas `#FFFFFF`, surface `#F6F7F9`, ink `#15191F`, muted `#5B6270`, hairline `#E3E6EA`, primary action = ink, Kleen blue `#1F7FC0` for links & selection, Kleen yellow `#FFC531` as the *attention* marker (overdue rows). Dark: canvas `#101317`, surface ladder `#161A20 / #1C2128`, ink `#E9ECF0`.
- **Type:** IBM Plex Sans Arabic + IBM Plex Sans (designed as one family → AR/EN look identical in weight and rhythm).
- **Layout:** start-side sidebar; KPIs as a single hairline-divided strip (no cards); branches as one table grouped by city; maintenance queue as a table.
- **Bold in one place:** the yellow attention bar on overdue items.

### B — Control Room (Linear-led) · dark-first, compact, calm
- **Color:** dark canvas `#0E1116`, surfaces `#141820 / #1A1F28 / #212733`, ink `#E8EBF0`, muted `#9AA3B2`, hairline `#262C38`, single accent Kleen blue `#3A9BE0` (action, focus, selection). Light: canvas `#F7F8FA`, surface `#FFFFFF`, ink `#14181F`.
- **Type:** Readex Pro (one variable family covering Arabic + Latin).
- **Layout:** slim icon rail + content; branches as a list with an inline staffing bar per row; tickets as an inbox list with status dots.
- **Bold in one place:** the live "today" header with the overdue count.

### C — Fresh Fold (Mercury-led) · soft, roomy, phone-first
- **Color:** canvas `#F4F7FB` (cool, not cream), surface `#FFFFFF`, ink `#1B2235`, muted `#5D6683`, tint `#E7F1FB`, primary Kleen blue `#1F7FC0`, warmth from Kleen yellow only on today's date chip. Dark: night `#121726`, raised `#1A2033`, ink `#E8ECF6`.
- **Type:** Noto Kufi Arabic for headings, Noto Sans Arabic + Noto Sans for body.
- **Layout:** greeting + today summary; city segmented control; one panel per city with branch rows inside (not a grid of identical cards); tickets as soft rows with pill status.
- **Bold in one place:** the large "today" summary numbers.

## Self-review against generated-UI defaults (choosing-direction.md §4)
- Not cream + terracotta, not near-black + acid accent: B is dark but its accent is the brand blue, and it ships a full light mode.
- Avoided the SaaS card kit: A uses no cards for KPIs; C groups branches inside city panels instead of 21 identical cards.
- Removed template chrome found in the current site: middle-dot meta strings ("الرياض · Al Aqiq"), arrow-suffixed links, uniform badges everywhere.
- No ALL-CAPS eyebrows (and none exist in Arabic). No mono labels. Numbers use tabular figures.
