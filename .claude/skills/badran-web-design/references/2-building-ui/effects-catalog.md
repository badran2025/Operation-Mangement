# Effects catalog (by purpose) — pick at most ONE hero effect per page

Names are the registry item names. M = Magic UI (`@magicui`), A = Aceternity (`@aceternity`), P = Motion Primitives (`@motion-primitives`).

| Purpose | Components | OK in ops apps? |
|---|---|---|
| **Numbers that change** | M `number-ticker`, P `animated-number`, P `sliding-number`, M `animated-circular-progress-bar` | ✅ KPIs, counters (respect reduced motion) |
| **Lists that receive items** | M `animated-list`, P `animated-group`, P `in-view` | ✅ sparingly (notifications/activity) |
| **Detail without leaving the list** | P `morphing-dialog`, P `morphing-popover`, P `transition-panel`, P `disclosure`, P `accordion` | ✅ good fit |
| **Text effects** | M `text-animate`, `typing-animation`, `word-rotate`, `hyper-text`, `aurora-text`, `animated-gradient-text`, `sparkles-text`, `morphing-text`, `highlighter`; A `flip-words`, `typewriter-effect`, `text-generate-effect`, `encrypted-text`; P `text-effect`, `text-shimmer`, `text-scramble`, `text-morph`, `text-loop`, `text-roll` | ❌ marketing only (P `text-shimmer` OK for a "loading…" label) |
| **Backgrounds** | M `dot-pattern`, `grid-pattern`, `animated-grid-pattern`, `flickering-grid`, `retro-grid`, `ripple`, `light-rays`, `meteors`, `particles`, `noise-texture`, `dither-field`, `warp-background`; A `background-lines`, `spotlight`, `hero-highlight`, `sparkles` | ❌ (a static `dot-pattern`/`grid-pattern` behind an empty state is fine) |
| **Cards / borders** | M `magic-card`, `border-beam`, `shine-border`, `neon-gradient-card`, `bento-grid`; A `focus-cards`, `3d-pin`, `glowing-stars-effect`; P `glow-effect`, `border-trail`, `spotlight`, `tilt` | ❌ (bento-grid layout is fine for landing features) |
| **Buttons** | M `shimmer-button`, `rainbow-button`, `pulsating-button`, `ripple-button`, `interactive-hover-button`, `shiny-button`, `cool-mode`, `confetti` | ❌ except `confetti` for a rare real milestone |
| **Scroll & reveal** | M `blur-fade`, `text-reveal`, `scroll-progress`, `scroll-based-velocity`, `progressive-blur`; A `container-scroll-animation`, `hero-parallax`, `macbook-scroll`; P `scroll-progress`, `progressive-blur` | ❌ marketing only |
| **Showcase / mockups** | M `iphone`, `android`, `safari`, `terminal`, `code-comparison`, `file-tree`, `marquee`, `dock`, `globe`, `dotted-map`, `icon-cloud`, `orbiting-circles`, `animated-beam`, `avatar-circles`, `tweet-card`, `hero-video-dialog`; A `3d-marquee`, `github-globe`; P `infinite-slider`, `carousel`, `image-comparison`, `dock`, `toolbar-expandable` | landing only (`avatar-circles` OK for assignees) |
| **Cursor / pointer** | M `pointer`, `smooth-cursor`, `lens`; P `cursor`, `magnetic` | ❌ |
| **Theme toggle** | M `animated-theme-toggler` (View Transitions) | ✅ if the app has dark mode |

Before adding any effect ask: *what change or meaning does this motion explain?* If the answer is "it looks cool", it belongs on a marketing page, once.
