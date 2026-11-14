# Motion tools — cheapest that works

| Need | Tool |
|---|---|
| Hover/press/color/state change | **CSS transitions** with the easing tokens |
| Element entering the DOM | CSS `@starting-style` + transition |
| Page/route or layout swap, theme toggle | **View Transitions API** (Magic UI `animated-theme-toggler` uses it) |
| React enter/exit, layout, gestures, springs | **Motion** (`motion/react`) — what shadcn ecosystems (Magic UI, Motion Primitives) use |
| Timelines, SVG line-draw/morph/motion-path, big staggers, scroll-synced sequences, framework-free pages | **Anime.js v4** |
| Ready micro-interactions | **MicroKit** (`@microkit/*`), Motion Primitives, Uiverse |
| Apple-style refractive glass | **Liquid Glass** web components |

## Anime.js v4 (MIT) — https://animejs.com · github.com/juliangarnier/anime
`npm i animejs` — ES modules:
```js
import { animate, createTimeline, stagger, onScroll, svg, createSpring } from 'animejs';
animate('.card', { y: [16, 0], opacity: [0, 1], delay: stagger(60), ease: 'outQuint', duration: 600 });
const tl = createTimeline({ defaults: { ease: 'outExpo' } });
tl.add('.a', { opacity: 1 }).add('.b', { x: 0 }, '-=200');
animate(svg.createDrawable('.path'), { draw: ['0 0', '0 1'], duration: 1200 }); // line drawing
animate('.box', { x: 200, autoplay: onScroll({ sync: true }) });                 // scroll-synced
```
Modules (verified in source): `animate`, `createTimeline`, `stagger`, `onScroll`, `createSpring`, `createDraggable`, `createScope` (React), `svg.{createDrawable, morphTo, createMotionPath}`, `text` (split / scramble), layout animations, `waapi` (lightweight Web Animations API mode), `utils`, `easings`. Features: per-property params, keyframes, individual CSS transforms with blend composition, advanced stagger (from center/grid). Respect reduced motion yourself (check `matchMedia('(prefers-reduced-motion: reduce)')`).
Use for: marketing explainers, illustrated empty states/onboarding, SVG logo/line animations. Don't use for routine app UI (CSS is enough).

## MicroKit UI (MIT) — https://microkit.co · github.com/henriquegpb/microkit
56 copy-paste micro-interactions (React or pure CSS), official shadcn registry: `npx shadcn@latest add @microkit/<name>`. Full source as text: https://microkit.co/llms-full.txt.
**Good for ops apps:** Hold to Delete Button (safe destructive action), Fuse Undo Button (archive with undo window), Progress Ring Check (task status), Bounce Checkbox (task done), Count Up Number (KPI on first view), Glide Pill Tabs / Sliding Underline Tabs / Sliding Content Tabs (filters & tabs), Spotlight Indicator (sidebar active item), Focus Field, Scrub Number Field.
Marketing-only: the glow/orbit/shine CTA buttons. Restyle the default orange accent to DESIGN.md tokens.

## Uiverse (MIT) — https://uiverse.io · github.com/uiverse-io/galaxy
Open-source community collection of HTML/CSS elements (~3,800 in the repo: buttons 1,231 · cards 726 · loaders 718 · toggle switches 260 · inputs 226 · forms 180 · checkboxes 171 · patterns 103 · radio buttons 102 · tooltips 62 · notifications 23), convertible to Tailwind/React on the site.
Quality varies: pick, then rewrite with our tokens, semantic HTML, focus states and reduced motion. Best use: **loaders** and **CSS background patterns**. (The site blocks automated access — browse it manually or read the GitHub repo.)

## Liquid Glass (MIT) — https://liquidglass.dev · github.com/gentpan/liquidglass
Real refraction (SVG displacement through CSS `filter`) in Chrome, Safari and Firefox; 11 web components on one engine: `<lg-switch> <lg-slider> <lg-segmented> <lg-button> <lg-panel> <lg-navbar> <lg-menubar>/<lg-menu> <lg-dock> <lg-lens>` + `toast()`; native controls stay underneath (a11y kept). Agent skill vendored: `vendor/liquid-glass-skill/SKILL.reference.md` — **use its bundled engine, never rewrite the filter from memory**.
Use only when the design direction is glassy (luma-style), over a **known** backdrop (image/illustration). Glass over arbitrary scrolling DOM only truly refracts in Chromium — say so instead of faking it. Check contrast of text on glass, and performance on low-end phones.

## Kinetics — https://kinetics.colorion.co
162 interface animations (CSS, 99 React, 153 prompts) and a **spring curve generator** that exports CSS `linear()` and React values. Reference only (no license in repo): use for ideas and to generate spring curves, write our own code.
