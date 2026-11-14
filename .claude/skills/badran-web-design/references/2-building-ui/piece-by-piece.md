# Building a page piece by piece

Never generate a whole page in one shot. Build **outside-in**, verify each piece in the browser, then move to the next.

## The ladder
1. **Shell** — app layout: nav (sidebar on desktop, bottom bar / sheet on mobile), header, content width, page padding. Verify: 360px and 1280px, RTL, focus order.
2. **Page skeleton** — the page's sections as empty labelled boxes in final positions (ASCII wireframe → real layout). Verify hierarchy: can you tell the primary job in 3 seconds?
3. **Sections / blocks** — one at a time, top to bottom. For each: start from an existing block (shadcn blocks `@shadcn/dashboard-01`, `sidebar-*`, `login-*`; or a registry item) and adapt — don't invent from zero.
4. **Components inside each block** — canonical names (part 1 `component-names.md`), built from shadcn primitives.
5. **Data & states** — wire real data, then add **loading (Skeleton), empty (Empty), error (Alert), long content, no-permission** for every data view.
6. **Behavior** — the UI must not be decorative: search filters, sort works, tabs and filters live in the URL, counts update, confirmations on destructive actions.
7. **Polish pass** — part 1 `ui-details-checklist.md`, then part 3 motion (only where it explains a change).
8. **Screenshot review** at 1280 and 390 px (light + dark if supported), fix, re-shoot.

Commit after each rung so it is easy to compare and revert.

## Describe each piece before building it (prompt anatomy)
Learned from VibePrompt's section prompts — a piece is specified by four things:

1. **Structure** — containers and order. "Card: header row (title, search input, Add button), then table."
2. **Content** — real fields and sample values. "Columns: Name, Status pill, Branch, Created."
3. **States** — visual + data states. "Status pills green/amber/gray; row hover; 'no results' row; loading skeleton rows."
4. **Behavior** — what actually works. "Search filters live; Name/Created sortable with arrow on active column; row count in header."

Write this 4-part spec (2–4 lines) in the plan for every block; it is also the acceptance test.

## Common block recipes

| Page | Composition |
|---|---|
| Dashboard / overview | Sidebar shell + KPI row (Card × 3–5, tabular numbers) + main chart Card + table/list Card + activity feed |
| List / records | Toolbar (search, filters as ToggleGroup/Select, primary action) + Table (sticky header) + Pagination; Sheet for quick detail |
| Detail | Header (title, status Badge, primary action) + two columns: content tabs + side panel (meta, actions, timeline) |
| Form / settings | Tabs or section nav + `FieldGroup`s in Cards + sticky save bar; inline errors; keep values on error |
| Ticket / workflow | Status + priority + owner up top; timeline (events with actor + time); comment box with attachments; role-specific action panel |
| Auth | Centered card or split screen; one primary action; clear error text |
| Landing | Nav · Hero · Logo cloud/social proof · Features (bento or alternating) · Stats · Testimonials · Pricing · FAQ · CTA · Footer |

## Dashboard pattern names (VibePrompt "Dashboards" category — useful vocabulary)
Sidebar + stat cards · Data table with toolbar · Chart card with legend · Activity feed panel · Analytics overview with range chips ·
Approvals queue with detail drawer · Inbox split view · Incident board · Kanban board · Week schedule grid · Team & roles admin ·
Usage & billing meters · Regional performance board · Inventory replenishment cockpit · Log viewer · Cost explorer · Feature-flag rollout panel.
(e.g. operations app: *week schedule grid* for shifts, *approvals queue with detail drawer* for tickets, *regional performance board* for cities/branches.)

## Definition of done for a piece
- Matches DESIGN.md tokens (no raw hex, no one-off spacing).
- Works at 360px without horizontal scroll; RTL correct.
- Keyboard reachable with visible focus; labels on all inputs.
- All states present; real data; behavior works.
