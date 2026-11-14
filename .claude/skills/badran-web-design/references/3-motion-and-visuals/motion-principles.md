# Motion principles

Condensed from Emil Kowalski's skills (MIT, full: `vendor/emil-kowalski-skills/emil-design-eng`, `animate`, `review-animations`, `animation-vocabulary`) and *make-interfaces-feel-better* (MIT).
Run the questions **in order** — 1 and 2 gate everything.

## 1. Should it animate at all? (frequency)
| How often the user sees it | Decision |
|---|---|
| 100+ times/day (shortcuts, command palette, filters, typing) | **No animation** |
| Tens of times/day (hover, list navigation, tab switches) | Remove or ≤150ms opacity/color only |
| Occasional (modals, drawers, toasts, saving) | Standard animation |
| Rare (onboarding, first success, milestone) | Delight allowed |
Never animate keyboard-initiated actions.

## 2. What is it for? (one of these, or don't animate)
Spatial consistency (enters/leaves from where it lives) · State change (button morphs to "Saved") · Explanation (marketing) · Feedback (press) · Preventing a jarring jump (content appearing). "Looks cool" is valid only on rare, marketing moments.

## 3. Easing (tokens — define once in DESIGN.md / CSS)
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* enter/exit, UI default */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* moving/morphing on screen */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* sheets/drawers */
```
Entering/exiting → ease-out · moving on screen → ease-in-out · hover/color → ease · constant motion → linear. **Never ease-in for UI.**

## 4. Duration
| Element | Duration |
|---|---|
| Press feedback | 100–160ms |
| Tooltip, small popover | 125–200ms |
| Dropdown, select | 150–250ms |
| Modal, drawer, sheet | 200–500ms |
| Toast | ~400ms |
UI stays under 300ms unless it is a modal/drawer/toast. Faster feels more responsive.

## 5. Springs (when it should feel physical)
For drag/gestures, interruptible motion, "alive" elements. Prefer `{ type: "spring", duration: 0.5, bounce: 0.2 }` (bounce 0.1–0.3; none in most UI). Springs keep velocity when interrupted. CSS-only springs: sample a curve into `linear()` (Kinetics' spring generator does this: https://kinetics.colorion.co).

## 6. Build rules
- Animate **transform / opacity / filter / clip-path** only — never width/height/top/left/margin.
- Never `transition: all`; never enter from `scale(0)` → use `scale(0.95)` + `opacity: 0`. Press: `scale(0.96)`.
- Popovers grow from their trigger (`transform-origin: var(--transform-origin)`); modals from center.
- CSS transitions for interactive state (interruptible); keyframes only for one-off sequences. `@starting-style` for enter.
- Exits softer and shorter than enters; stagger groups 30–80ms (only infrequent entrances).
- Gate hover motion: `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion`: ship a gentler variant (opacity only), not nothing — at the same time as the animation.
- Motion is never the only signal: pair with color/icon/text change.
- **RTL:** anything that slides horizontally slides from the *inline-start*; mirror x-offsets with `[dir=rtl]` or logical utilities (`slide-in-from-start`). Progress fills right→left in Arabic.
- Skip enter animations on first page load (`AnimatePresence initial={false}`).

## 7. Review
Slow the animation to 10% in DevTools and walk every state. Use `vendor/emil-kowalski-skills/review-animations` for a formal review; `find-animation-opportunities` to spot missing feedback; `remove-animations` when a UI feels slow.
