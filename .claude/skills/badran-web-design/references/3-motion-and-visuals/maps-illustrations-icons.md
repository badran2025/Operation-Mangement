# Maps, illustrations, 3D icons & UI icons

## Maps — mapcn (MIT) — https://www.mapcn.dev · github.com/AnmolSaini16/mapcn
shadcn-style map components on MapLibre GL + Tailwind; themed by our shadcn variables; free CARTO/OpenStreetMap basemap (no API key).
Agent skill vendored: `vendor/mapcn-skill/SKILL.reference.md` (+ `references/`). Read it before building a map.
```bash
npx shadcn@latest add @mapcn/map          # components/ui/map.tsx (+ maplibre-gl)
npx shadcn@latest add @mapcn/<block>      # full pages: store locator, delivery tracker, analytics map…
```
Rules: give the map's parent a height · coordinates are **[longitude, latitude]** (most common bug) · client component only (fetch data in a server component, pass down) · read props in the installed `map.tsx`, don't hand-write it · routes don't fetch directions — pass coordinates · popups/markers use theme tokens · basemap follows light/dark.
Fits: branch/store locator, deliveries & technicians' routes, per-city/region stats (choropleth), logistics links (arcs). For Arabic UIs, check label language of the basemap and RTL of popups.

## Illustrations — Kitbitz (CC0) — https://kitbitz.art
2,000+ hand-drawn illustrations in themed kits (city, interior, nature, space, winter, medieval, cyberpunk, western, pirate, dungeon, ruins, Halloween, Barbieland). SVG + PNG, Figma kits & plugin. **CC0: free for commercial use, no attribution.**
- Catalog JSON: https://kitbitz.art/catalog.v1.json · MCP (read-only, search + download URLs): `https://mcp.kitbitz.art` → `claude mcp add --transport http kitbitz https://mcp.kitbitz.art`.
- Use for: empty states, onboarding, 404/error pages, marketing sections. **One kit per product** (consistent line style); recolor SVG strokes/fills to DESIGN.md tokens; keep them small in apps (≤ 160px in empty states).

## 3D icons — 3dicons (CC0) — https://3dicons.co
1,440+ Blender-made 3D icons (key, clock, map pin, shield, folder, chart, wallet, tools, calendar, chat…), several angles and color/material variants; online editor to change color & angle; Figma file. **CC0 v1: free for personal & commercial use, no attribution.**
- Use for: hero/feature illustrations, onboarding, empty states, marketing cards, app-store visuals. **Never** as inline UI icons (buttons, nav, tables) — too heavy and inconsistent at small sizes.
- Export PNG/WebP at 2× the display size, `loading="lazy"`, explicit width/height; pick one angle and one material for the whole product.

## UI icons (inline)
- One library per product, matching shadcn's configured `iconLibrary` (default **Lucide**; alternatives Tabler, Phosphor, Hugeicons). Read it from `npx shadcn@latest info`.
- Stroke matches text weight (1.5px with 400, 2px with 600); `currentColor`; outline = default, filled = active state.
- Inside shadcn buttons use `data-icon="inline-start|inline-end"`; no size classes.
- RTL: mirror directional icons (arrows, chevrons, back/forward, undo/redo, send, reply) with `rtl:rotate-180` / `rtl:-scale-x-100`; never mirror clocks, checkmarks, play/media, logos, or numbers.
- Animated icons: 21st.dev `community/icons/animated` — only for state changes (copy → check), not decoration.
- Icon-only buttons need `aria-label`; decorative icons `aria-hidden`.

## Decision table
| Need | Use |
|---|---|
| Show where branches/stores/technicians are | mapcn map + markers/popups |
| Empty list / first-time screen | Small Kitbitz illustration or one 3D icon + one action |
| Marketing hero / feature cards | 3dicons or Kitbitz (one style per page) |
| Buttons, nav, table actions | Lucide (or configured) line icons |
| Celebrate a rare milestone | Magic UI `confetti` (once) |
