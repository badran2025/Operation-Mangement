# Inspiration sources (part 1 of 3)

How and when to use each of the 7 sources. Browse them **before** designing anything new; pick 2–3 concrete references and write down what you take from each.

| # | Source | What it is | Use it for | How |
|---|---|---|---|---|
| 1 | **Minimal Gallery** — https://minimal.gallery | Hand-picked website gallery since 2013, filterable by type (SaaS, agency, portfolio, e-commerce, one-page…) | Overall mood, restraint, whitespace, typography pairing on marketing / landing pages | Filter by the project's type; open 5–10 sites; note type scale, grid, and how few colors they use |
| 2 | **Kage** — https://kage.design | 600+ real product interfaces, 3,300+ components tagged by component (hero, pricing, table, sidebar, form, stats…), style (minimal, dark, editorial, dense, bento…) and color; turns a design into a prompt for coding agents. Also curates agent design skills | Finding a **specific component** done well (e.g. "table", "stats", "empty states", "dashboard") | `https://kage.design/components/<name>`, `/design/dashboard`, `/design/empty-state`, `/color/<color>`. Its skills page is what led to the vendored skills in `vendor/` |
| 3 | **Appshot Gallery** — https://www.appshot.gallery | 800+ apps / 5,500+ App Store screenshots by genre, tone, style, color, font style, plus guides | **Mobile app** marketing screenshots and app-store presentation; mobile visual tone | Only for mobile app launches. Guides: one clear promise on the first slide, readable product view, localize layout-first (important for Arabic) |
| 4 | **The Component Gallery** — https://component.gallery | 60 components × 95 design systems × 2,600+ examples | **What to call a component** and how mature systems build it (accessibility, states) | See `component-names.md`; open the component page and compare 3 research-backed systems |
| 5 | **getdesign.md** — https://getdesign.md | 550+ DESIGN.md analyses of real sites, following Google Stitch's DESIGN.md spec. Open subset (84) is vendored in `design-md/` | Picking a complete, consistent **visual language** (tokens + rules) | Pick from `style-catalog.md`, read the DESIGN.md, then adapt it into the project's own DESIGN.md (see `design-md-spec.md`) |
| 6 | **Refero Styles** — https://styles.refero.design | 2,000+ AI-readable styles (colors, type, spacing, components) with DESIGN.md per style; curated prompt collections (dashboard, landing page, Claude Code) | More style directions, especially **dashboards** (`/ai-agents/dashboard-design-prompts`: editorial / precise / expressive directions) | Use its brief template (below). Values are Refero-generated analyses, not official guides |
| 7 | **Jiro** — https://jiro.build | 1,400+ website sections & templates as copy-paste design prompts; MCP server | Marketing **sections** (hero, pricing, FAQ, testimonials, footer…) when building landing pages | Mostly paid. Optional MCP: `claude mcp add --transport http jiro https://mcp.jiro.build` (needs a Jiro account) |

## Brief template (adapted from Refero)

Fill the brackets with real product facts before designing:

> Design [screen] for [audience] so they can [specific job]. Use [reference] DESIGN.md for its type and color roles only. Use our real copy, data and behavior — the reference does not define them. Include [required sections] and the loading, empty and error states. Explain which visual decisions came from the reference and which you changed for this product.

Dashboard variant:

> Build [overview] for [product] used by [role]. The main job is [decision or action]. Use our actual metric names and data. Include [filters and actions]. Show loading, empty and error states. Explain which rules you kept from the reference and where the dashboard needs a different layout.

## Legal / ethical rules

- References give **direction**, not assets. Never copy a brand's logo, name, product copy, illustrations, or proprietary fonts.
- If a referenced font is proprietary (e.g. "Linear Display", "Airbnb Cereal"), use the substitute the DESIGN.md suggests or an open font with similar metrics.
- Paid sources (Jiro premium, getdesign private files): only use what the user has access to.
