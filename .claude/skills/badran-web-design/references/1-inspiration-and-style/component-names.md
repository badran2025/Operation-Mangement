# Component names & essentials

Naming follows The Component Gallery (component.gallery — 60 components across 95 design systems).
Use these **canonical names** in code and conversation; aliases show what other systems call the same thing.
`#` = how many real design systems implement it (a proxy for how standard it is).

## Essentials for operations / admin apps (own guidance)

- **Badge** — Status (open/overdue/closed). Max 1–2 per row; color + text, never color alone; same status = same color everywhere.
- **Alert** — Inline, persistent messages tied to a page/section (e.g. 59 overdue tickets). Not for transient feedback — use Toast.
- **Modal** — Blocking decisions only (confirm delete). Focus trap, Esc closes, return focus to trigger.
- **Select** — Native select for ≤ ~15 options; Combobox when searchable (e.g. 21 branches).
- **Tabs** — Switch views of the same data (open / overdue / closed). Reflect the active tab in the URL.
- **Card** — Summary tiles (branch, KPI). Whole card clickable only if it has one destination; keep one radius scale by hierarchy.
- **Tooltip** — Supplementary text only; never hide required info or actions in tooltips (no hover on touch).
- **Table** — Records lists. Sticky header, tabular-nums, right-align numbers (left in RTL), row hover, empty state, horizontal scroll on mobile — never squash columns.
- **Navigation** — Primary nav: ≤ 7 items, current page marked, collapses to bottom bar / menu on mobile.
- **Breadcrumbs** — Deep pages (Branch › Worker). Not needed on 1–2 level apps.
- **Pagination** — Lists > ~50 rows; keep page in URL.
- **Datepicker** — Use native date input on mobile; show dates in the business time zone.
- **Toast** — Transient confirmation after an action ("Saved"). aria-live="polite"; never the only place an error appears.
- **Avatar** — People (assignee, reporter). Initials fallback.
- **Drawer** — Side panel for quick edit/detail without leaving the list (great for ticket preview on desktop; bottom sheet on mobile).
- **Progress indicator** — Multi-step flows and ticket lifecycle (new → assigned → in progress → resolved → closed).
- **Combobox** — Searchable select — branch / worker / technician pickers.
- **File upload** — Show thumbnails, size limits, progress, and allow removal before submit.
- **Search input** — Global search (⌘K) across branches, workers, tickets.
- **Skeleton** — Loading placeholder that mirrors final layout; prefer over spinners for page/list loads.
- **Segmented control** — Small mutually-exclusive filters (priority, view mode).
- **Empty state** — Every list needs one: what this is, why it is empty, the one action to fill it.

## Full index

| Component | # | Also called | Reference |
|---|---|---|---|
| Badge | 123 | Tag, Label, Chip | https://component.gallery/components/badge/ |
| Button | 118 | — | https://component.gallery/components/button/ |
| Alert | 108 | Notification, Feedback, Message, Banner, Callout | https://component.gallery/components/alert/ |
| Accordion | 101 | Arrow toggle, Collapse, Collapsible sections, Collapsible, Details, Disclosure, Expandable, Expander, ShowyHideyThing | https://component.gallery/components/accordion/ |
| Radio button | 85 | Radio, Radio group | https://component.gallery/components/radio-button/ |
| Checkbox | 84 | — | https://component.gallery/components/checkbox/ |
| Modal | 82 | Dialog, Popup, Modal window | https://component.gallery/components/modal/ |
| Select | 82 | Dropdown, Select input | https://component.gallery/components/select/ |
| Tabs | 80 | Tabbed interface | https://component.gallery/components/tabs/ |
| Card | 77 | Tile | https://component.gallery/components/card/ |
| Tooltip | 74 | Toggletip | https://component.gallery/components/tooltip/ |
| Table | 73 | — | https://component.gallery/components/table/ |
| Text input | 72 | — | https://component.gallery/components/text-input/ |
| List | 67 | — | https://component.gallery/components/list/ |
| Spinner | 66 | Loader, Loading | https://component.gallery/components/spinner/ |
| Link | 64 | Anchor, Hyperlink | https://component.gallery/components/link/ |
| Navigation | 62 | Nav, Menu | https://component.gallery/components/navigation/ |
| Toggle | 60 | Switch, Lightswitch, Toggle button | https://component.gallery/components/toggle/ |
| Breadcrumbs | 55 | Breadcrumb trail | https://component.gallery/components/breadcrumbs/ |
| Textarea | 52 | Textbox, Text box | https://component.gallery/components/textarea/ |
| Popover | 50 | — | https://component.gallery/components/popover/ |
| Dropdown menu | 49 | Select menu | https://component.gallery/components/dropdown-menu/ |
| Pagination | 48 | — | https://component.gallery/components/pagination/ |
| Icon | 45 | — | https://component.gallery/components/icon/ |
| Datepicker | 44 | Calendar, Datetime picker | https://component.gallery/components/datepicker/ |
| Toast | 41 | Snackbar | https://component.gallery/components/toast/ |
| Progress bar | 40 | Progress | https://component.gallery/components/progress-bar/ |
| Avatar | 38 | — | https://component.gallery/components/avatar/ |
| Drawer | 38 | Tray, Flyout, Sheet | https://component.gallery/components/drawer/ |
| Header | 38 | — | https://component.gallery/components/header/ |
| Progress indicator | 38 | Progress tracker, Stepper, Steps, Timeline, Meter | https://component.gallery/components/progress-indicator/ |
| Slider | 38 | Range input | https://component.gallery/components/slider/ |
| Combobox | 37 | Autocomplete, Autosuggest | https://component.gallery/components/combobox/ |
| Button group | 35 | Toolbar | https://component.gallery/components/button-group/ |
| Separator | 34 | Divider, Horizonal rule, Vertical rule | https://component.gallery/components/separator/ |
| Fieldset | 32 | — | https://component.gallery/components/fieldset/ |
| File upload | 32 | File input, File uploader, Dropzone | https://component.gallery/components/file-upload/ |
| Search input | 30 | Search | https://component.gallery/components/search-input/ |
| Skeleton | 30 | Skeleton loader | https://component.gallery/components/skeleton/ |
| Heading | 29 | — | https://component.gallery/components/heading/ |
| Image | 29 | Picture | https://component.gallery/components/image/ |
| Segmented control | 28 | Toggle button group | https://component.gallery/components/segmented-control/ |
| Carousel | 22 | Content slider | https://component.gallery/components/carousel/ |
| Form | 21 | — | https://component.gallery/components/form/ |
| Stepper | 20 | Nudger, Quantity, Counter | https://component.gallery/components/stepper/ |
| Footer | 19 | — | https://component.gallery/components/footer/ |
| Rating | 19 | — | https://component.gallery/components/rating/ |
| Color picker | 18 | — | https://component.gallery/components/color-picker/ |
| Date input | 18 | — | https://component.gallery/components/date-input/ |
| Empty state | 16 | — | https://component.gallery/components/empty-state/ |
| Label | 15 | Form label | https://component.gallery/components/label/ |
| Video | 15 | Video player | https://component.gallery/components/video/ |
| Skip link | 14 | — | https://component.gallery/components/skip-link/ |
| Tree view | 14 | — | https://component.gallery/components/tree-view/ |
| Quote | 11 | Pull quote, Block quote | https://component.gallery/components/quote/ |
| Visually hidden | 11 | Screenreader only | https://component.gallery/components/visually-hidden/ |
| Stack | 10 | — | https://component.gallery/components/stack/ |
| Hero | 9 | Jumbotron, Banner | https://component.gallery/components/hero/ |
| File | 6 | Attachment, Download | https://component.gallery/components/file/ |
| Rich text editor | 5 | RTE, wysiwyg editor | https://component.gallery/components/rich-text-editor/ |

Rule from the gallery's author worth keeping: popular ≠ correct. Prefer patterns backed by research (GOV.UK, Atlassian, Shopify Polaris, IBM Carbon) over copying what everyone does.