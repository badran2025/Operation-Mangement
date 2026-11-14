# Foundation: shadcn/ui on Next.js + Tailwind v4

Default stack for every web app/site built with this skill (unless the project already has another UI system).
shadcn/ui is not a dependency: components are **copied into the project as source** and restyled from our DESIGN.md.
Official agent skill (MIT) is vendored in `vendor/shadcn-skill/` — read `SHADCN-SKILL.md` + `rules/*.md` before writing shadcn code.

## Setup

```bash
# new project (Next.js App Router). Pick the style by geometry (table below).
npx shadcn@latest init --base base --preset <style> --template next --name <app> --no-monorepo -y
# existing Next.js project
npx shadcn@latest init --base base --preset <style>
npx shadcn@latest info --json          # read base, style, iconLibrary, tailwindCssFile, aliases
npx shadcn@latest add button card field input select table badge tabs dialog sheet sonner skeleton empty sidebar
```

Always pass `--preset` or `--base` (otherwise init stops at an interactive prompt). Read `info --json` before writing code.

## Pick the style by the DESIGN.md's geometry

| Style | Character | Pick when |
|---|---|---|
| `vega` | Classic shadcn | Neutral SaaS, nothing extreme |
| `nova` | Compact paddings | 32–36px controls, 6–8px radius, hairlines over shadows |
| `mira` | Dense | Data-heavy ops/admin tables, 28–32px controls |
| `maia` | Soft & generous | 40px+ controls, 12px+ cards, editorial pacing |
| `luma` / `rhea` | Rounded, soft elevation / same but denser | Pill buttons, layered soft shadows |
| `lyra` | Boxy & sharp | 0–4px radius, technical/mono feel |
| `sera` | Editorial & typographic | Serif display, magazine hierarchy |

Ops dashboards used on phones in branches → usually `nova` or `rhea` (dense enough, still 40px+ touch targets).

## Arabic / RTL (first-class in shadcn)

- Set `"rtl": true` in `components.json` **before** adding components: the CLI converts `left/right` → `start/end`, `ml/mr` → `ms/me`, slide animations to logical, and flips supported icons (`rtl:rotate-180`).
- Existing components: `npx shadcn@latest migrate rtl`. Calendar, Pagination and Sidebar need the manual RTL notes in their docs.
- Wrap the app with `<html lang="ar" dir="rtl">` and the `Direction` provider; pass `dir="rtl"` to portalled content (Popover, Tooltip) if needed.
- Fonts: Noto family is recommended by shadcn; see part 1 `choosing-direction.md` for Arabic typeface choices.
- Known issue: `tw-animate-css` logical slide utilities — verify dropdown/popover directions visually.

## DESIGN.md → theme (summary; full procedure: `vendor/shadcn-skill/design-system.md`)

Edit only the `tailwindCssFile`. Keep hex as hex.

| DESIGN.md role | shadcn variable |
|---|---|
| canvas | `--background` |
| ink | `--foreground`, `--card-foreground`, `--popover-foreground` |
| primary / on-primary | `--primary` / `--primary-foreground` (+ new `--primary-active`) |
| secondary button | `--secondary` / `--secondary-foreground` |
| soft band / muted text | `--muted` / `--muted-foreground` |
| ghost hover, active tab, menu highlight | `--accent` / `--accent-foreground` |
| card / floating layer | `--card` / `--popover` |
| hairline | `--border`, `--input` |
| focus | `--ring` |
| danger / warning / success / info | `--destructive`, plus `--warning`, `--success`, `--info` (+ `-foreground`) registered in `@theme inline` |
| chart series | `--chart-1 … --chart-5` |
| nav rail | `--sidebar-*` |

Radius: pin each DESIGN.md step to the class components use (`rounded-lg` buttons/inputs, `rounded-xl` cards/dialogs, `rounded-4xl` badges). Fonts and type roles become `@theme` font variables + `type-*` utilities. Restyle components by editing their `cva` variants; change control heights together.

## Non-negotiable shadcn rules (from the official skill)
- Use existing components before custom markup; compose (Settings = Tabs + Card + Field; Dashboard = Sidebar + Card + Chart + Table).
- Semantic tokens only (`bg-primary`, `text-muted-foreground`) — no raw colors, no manual `dark:` overrides.
- `flex … gap-*`, never `space-y-*`; `size-*` for squares; `truncate`; `cn()` for conditionals.
- Forms: `FieldGroup` + `Field` (+ `data-invalid` / `aria-invalid`); 2–7 options → `ToggleGroup`.
- Full Card composition (Header/Title/Description/Content/Footer). Dialog/Sheet/Drawer always have a Title.
- Status → `Badge`; callouts → `Alert`; empty → `Empty`; loading → `Skeleton`; button loading → `Spinner` + `disabled`.
- Icons in buttons use `data-icon="inline-start|inline-end"`, no size classes.
- Updating components: `add --dry-run` / `--diff`; never `--overwrite` without approval.
