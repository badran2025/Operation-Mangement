# Where pieces come from (part 2 sources)

Rule: **search before you build.** `npx shadcn@latest search <@registry> -q "<thing>"`, then `view`, then `add`. After adding from any community registry: read the files, fix import aliases, restyle to DESIGN.md tokens, check RTL and a11y.

| Source | What | License / cost | Install | Use for |
|---|---|---|---|---|
| **shadcn/ui** — ui.shadcn.com | Accessible core components + blocks (dashboard, sidebar, login, charts) + RTL + MCP | MIT, free | `npx shadcn@latest add <name>` / `@shadcn/<block>` | **Everything structural.** The base of every app |
| **Magic UI** — magicui.design | 150+ animated marketing components (text effects, backgrounds, device mockups, number ticker, bento) | MIT, free (Pro blocks paid) | `npx shadcn@latest add @magicui/<name>` | Landing pages; *small* touches in apps (NumberTicker on KPIs, Marquee for logos) |
| **Aceternity UI** — ui.aceternity.com | 200+ effect-heavy components, blocks, landing templates; MCP; JSON API at `/api/components` | Free + Pro (paid). Copy-paste for use in your projects — don't redistribute the library | `npx shadcn@latest add @aceternity/<name>` | Marketing heroes, showcase sections. Almost never in ops/admin UI |
| **Motion Primitives** — motion-primitives.com | ~35 motion building blocks: text effects, animated number, morphing dialog/popover, transition panel, in-view, infinite slider, progressive blur | MIT, free | `npx shadcn@latest add @motion-primitives/<name>` | Purposeful motion inside apps (morphing dialog for detail, sliding number, transition panel) |
| **21st.dev** — 21st.dev | Community registry, 12,000+ React/Tailwind components, themes, templates, icons (incl. animated); libraries: Aceternity, Magic UI, Origin UI, Kokonut UI, ReUI, Motion Primitives… 21st AI generates components | Each component has its own author/license — **check before using**; free tier + paid | Copy TSX or install via shadcn CLI; MCP + CLI for agents (`https://21st.dev/mcp`, API key) | Finding a specific polished piece fast. Append `.md` to any 21st URL for an agent-readable page |
| **VibePrompt** — vibeprompts.dev | 286 layout prompts + Tailwind snippets in 15 categories (auth, pricing, features/bento, hero, CTA, stats, nav, testimonials, footer, FAQ, dashboards, onboarding, blog, contact) | Free to browse; no stated license → use as reference, write our own code | — | Wording a piece precisely (see prompt anatomy in `piece-by-piece.md`); dashboard pattern vocabulary |
| **Kinetics** — kinetics.colorion.co | 162 interface animations (CSS + 99 React), spring-easing generator, 153 prompts | Repo has no license → reference only | — | Motion ideas & spring curves → part 3 |

Other registries built into the CLI: `@tailark` (marketing blocks), `@reui`, `@kokonutui`, `@animate-ui`, `@cult-ui`. Same rules apply.

## Choosing quickly
- **Ops / admin / internal tool:** shadcn core + shadcn charts + (optional) 1–2 Motion Primitives. No glowing borders, beams, meteors, particles.
- **Marketing / landing:** shadcn for structure; one hero effect from Magic UI or Aceternity; Marquee for logos; NumberTicker for stats; everything else calm.
- **Mobile-heavy users:** prefer CSS-only effects; check every effect at 390px and with reduced motion.
