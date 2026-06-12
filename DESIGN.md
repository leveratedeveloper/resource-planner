# DESIGN.md — Timeline Rebuild Design Contract

Created 2026-06-11 as Phase 1 of the timeline destroy-and-rebuild
(`docs/superpowers/plans/2026-06-11-timeline-rebuild.md`). Two kinds of content live here:

1. **Frozen** — the design system. The rebuild MUST use these tokens/primitives unchanged.
2. **Baseline** — how the current timeline looks/behaves. The rebuild may evolve these
   toward the Runn.io reference, but every departure should be deliberate.

---

## 1. Frozen — do not change

### 1.1 Color tokens (`app/globals.css`, Tailwind 4 `@theme inline`, OKLch)

All colors are CSS custom properties consumed via Tailwind semantic classes
(`bg-background`, `text-foreground`, `border-border`, …). Dark mode = `.dark` class
(`@custom-variant dark (&:is(.dark *))`).

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--card` / `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--card-foreground` / `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--secondary` / `--muted` / `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--secondary-foreground` / `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| `--chart-1…5` | orange/cyan/dark-blue/yellow-green/yellow | purple/cyan/yellow/magenta/red-orange |
| `--sidebar*` | white family | dark family (`--sidebar-primary` purple `oklch(0.488 0.243 264.376)`) |

Base layer: every element gets `border-border outline-ring/50`; body is
`bg-background text-foreground`.

### 1.2 Radii

`--radius: 0.625rem` (10px). Scale (computed): `sm` 6px, `md` 8px, `lg` 10px,
`xl` 14px, `2xl` 18px, `3xl` 22px, `4xl` 26px. shadcn components default to
`rounded-md`/`rounded-lg`.

### 1.3 Typography

- **Geist Sans** — `--font-geist-sans`, local `public/fonts/geist/geist-latin.woff2`, default UI font.
- **Geist Mono** — `--font-geist-mono`, local `public/fonts/geist/geist-mono-latin.woff2`.
- Body rendered `antialiased`. Common scales in use: buttons `text-sm font-medium`;
  dialog titles `text-lg font-semibold`; dialog descriptions `text-sm text-muted-foreground`;
  timeline lane labels `text-xs font-bold uppercase tracking-wider`; brand sub-labels
  `text-[10px] text-muted-foreground`; allocation cell labels `text-[11px] font-bold`.

### 1.4 Icons

- **lucide-react** in `components/ui/` primitives (XIcon, CheckIcon, chevrons, CircleIcon).
- **@iconify/react** in feature components with `lucide:` ids (e.g. `lucide:package`).
- Default icon size in buttons: `size-4` (16px) via `[&_svg:not([class*='size-'])]:size-4`.

### 1.5 shadcn/ui primitive inventory (`components/ui/`)

`alert-dialog`, `avatar` (32px `size-8`, `rounded-full`, muted fallback), `badge`,
`button`, `calendar`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`,
`InfiniteScrollTrigger`, `label`, `popover`, `radio-group`, `scroll-area`, `select`,
`separator`, `skeleton`, `tabs`, `textarea`, `toast` (custom + Iconify), `toggle`,
`toggle-group`, `tooltip`.

Button variants: `default | destructive | outline | secondary | ghost | link`;
sizes `default` h-9, `sm` h-8, `lg` h-10, `icon` size-9, `icon-sm` size-8, `icon-lg` size-10.
Focus ring (all interactive primitives): `focus-visible:border-ring focus-visible:ring-ring/50
focus-visible:ring-[3px]`. Invalid state: `aria-invalid:ring-destructive/20 aria-invalid:border-destructive`.
Dialog overlay: `fixed inset-0 z-50 bg-black/50` with Radix `animate-in/out` fade.
Rebuild rule: **reuse > extend > create** — check this inventory before any new primitive.

---

## 2. Timeline dimensional baseline (`lib/timeline-v2/layout.ts`, `date-range.ts`)

Legacy values (v1, for reference only): resource column 250px (clamp 220–420), summary row 56px, collapsed row 48px, project lane **34px** (off-grid magic number), JS-computed `cellWidth = availableWidth / columnCount` applied as inline `px` styles per cell, block inset `top: 4px / height: rowHeight - 4`.

### 2.1 Layout rules for the rebuild (Sora, HARD STOP 1 review) — no magic numbers

1. **Every fixed dimension snaps to the Tailwind spacing scale (4px grid) and is applied as a
   class, not an inline style:**

   | Dimension | Class | Resolved |
   |---|---|---|
   | Summary/collapsed row | `h-timeline-row` | 48px (the old "56px summary row" was only a virtualizer estimate) |
   | Project lane | `h-timeline-lane` | 32px (replaces 34px) |
   | Header strip | `h-timeline-header` | 48px |
   | Resource column default | token | 256px |
   | Resource column clamp | tokens | 224–416px (resize handle writes a CSS var, bounds on-scale) |
   | Bar vertical inset | `inset-y-0.5` | 2px each side |

2. **Columns are distributed by the browser, not by JS:** the date grid uses CSS Grid
   `grid-template-columns: repeat(var(--timeline-cols), minmax(0, 1fr))` (or `flex-1 basis-0`
   per column) — header and body share the same template so they align by construction.
   No per-cell inline `width: {cellWidth}px`.
3. **Bars position by percentage** of the lane canvas (`getTimelineV2RangePosition` already
   returns `leftPct/widthPct`) — independent of pixel cell width.
4. **JS measures, never dictates:** drag/pointer math derives column index from
   `getBoundingClientRect()` of the lane canvas at pointer-down (`rect.width / columnCount`),
   not from a duplicated cellWidth constant.
5. **Numeric constants survive only where virtualization demands them** (`estimateSize`,
   `scrollMargin`) and for the resize clamp — and they live in the dimension token system below,
   never inline in components.

### 2.2 Dimension token system (for the unavoidable numbers)

One name, two representations, drift-proofed by a test:

1. **CSS side (styling source of truth)** — timeline dimensions become Tailwind 4 `@theme`
   spacing tokens in `app/globals.css`, which auto-generate utilities (`h-timeline-lane`,
   `w-timeline-resource-col`, …):
   ```css
   @theme inline {
     --spacing-timeline-summary-row: 3.5rem;    /* 56px */
     --spacing-timeline-collapsed-row: 3rem;    /* 48px */
     --spacing-timeline-lane: 2rem;             /* 32px */
     --spacing-timeline-header: 3rem;           /* 48px */
     --spacing-timeline-resource-col: 16rem;    /* 256px default */
     --spacing-timeline-resource-col-min: 14rem;/* 224px */
     --spacing-timeline-resource-col-max: 26rem;/* 416px */
   }
   ```
   Components use ONLY these utilities for timeline dimensions — never `h-[34px]`-style
   arbitrary values, never inline pixel styles (exception: the resize handle writes the
   current column width into a CSS var bounded by the min/max tokens).
2. **TS side (geometry mirror)** — `lib/timeline-v2/layout.ts` exports the same values in px
   for the virtualizer and resize clamp:
   ```ts
   export const TIMELINE_DIMENSIONS = {
     summaryRow: 56, collapsedRow: 48, lane: 32, header: 48,
     resourceCol: { default: 256, min: 224, max: 416 },
   } as const;
   ```
   Nothing else in TS may declare a dimension; estimates derive from this object.
3. **Drift guard** — `tests/whitebox/timeline-dimension-tokens.test.ts` (this repo already has
   a source-test culture) reads `globals.css`, parses the `--spacing-timeline-*` rem values,
   and asserts `rem × 16 === TIMELINE_DIMENSIONS.*`. Editing one side without the other fails CI.
4. **Extension rule** — any future fixed dimension enters through this system (both files +
   test) or uses the standard Tailwind scale directly. Components never mint their own numbers.

View modes → columns (`getTimelineV2Columns`):

| Mode | Columns | Resolution | Label / sub-label |
|---|---|---|---|
| `week` | 7 days (Mon-start) | day | `EEE` / `d` |
| `month` | calendar month days | day | `EEE` / `d` |
| `quarter` | 3 months | month | `MMMM` |
| `halfYear` | 6 months | month | `MMMM` |
| `year` | 12 months | month | `MMMM` |

Weekend toggle: hides Sat/Sun columns in **day** resolution only (month resolution always
shows all). Column flags: `isWeekend`, `isToday`, `isCurrentMonth` drive header/cell styling.
`startDate/endDate` of the set span the full period (month-resolution end = `endOfMonth`).
Today-scroll: centers today's column (`todayIndex * cellWidth - viewportWidth/2 + cellWidth/2`).

---

## 3. Current color semantics (baseline — may evolve toward Runn)

### 3.1 Assignment bars (`components/timeline/AssignmentBlock.tsx`)

- Fill: **hardcoded `#2563eb`** (blue-600) at line 154. ⚠ Project/brand rows in the DB have a
  `color` field (default `#64748b` slate-500) that is NOT used by bars today.
  **Rebuild decision: bars become project-color-driven.**
- Shape: `absolute rounded-md shadow-sm border text-xs text-white`, content = bold name +
  total-hours label, 4px top inset.
- States: drag `cursor-grabbing opacity-70 ring-2 ring-blue-400 scale-[1.01]`; resize
  `ring-2 ring-blue-400`; updating `opacity-80 ring-1 ring-blue-300`; deleting
  `opacity-50 animate-pulse`; highlighted `ring-2 ring-amber-400 border-amber-200 shadow-md`.
- Resize handles: 4px-wide left/right strips, `bg-white/20 hover:bg-white/40`, `cursor-ew-resize`.
- Tooltip: `bg-slate-800 text-white border-slate-700` with dates + duration.

### 3.2 Allocation cells (`AllocationCellV2.tsx` + `lib/timeline/allocation-cell-model.ts`)

Plan utilization bands (rgba blue ramp; opacity = `clamp(pct, 0.3, 1)` below 100%):

| Band | Color |
|---|---|
| pct < 100% | `rgba(37,99,235, opacity)` (blue-600 fading) |
| pct ≥ 100% | `rgba(37,99,235,1)` |
| pct > 110% | `rgba(30,64,175,1)` (blue-800) |
| pct > 125% | `rgba(30,58,138,1)` (blue-900) |
| over 100% | adds `border-t-2 border-red-500` overbooked marker |

(Actual ramp exists in code as greens `rgba(22,163,74,…)` but is not rendered today —
only `planLabel` displays.) Empty cells: `border-r border-dashed`. Filled cells:
`border-r border-white/20`, label `text-[11px] font-bold text-white`, centered.

Allocation math (must survive rebuild byte-identically — see plan task 3.5/3.6):
`dailyCapacity = capacity / WORK_DAYS_PER_WEEK`; week view divides by hardcoded
`weeklyCapacity = 40`; month cells aggregate the whole calendar month counting a day when
`planHours > 0 || actualHours > 0 || weekday`; labels are `Math.round(pct*100)%`.
**Actual hours keep feeding `actualPct`** (user decision) even though actuals have no editing UI.

### 3.3 Rows, lanes, highlights (`ResourceRowV2.tsx`)

- Row hover: `hover:bg-accent/5 transition-colors`; rows separated by `border-b`.
- Project lane label: package icon (`lucide:package`, 14px) + `text-xs font-bold uppercase
  tracking-wider` name + `text-[10px] text-muted-foreground` brand.
- Normal lane: `bg-blue-50/10`, icon `text-blue-600`, label `text-blue-800`.
- Highlighted lane (matches brand/project filter): `bg-amber-50/70`–`/90`,
  icon `text-amber-600`, label `text-amber-800`.
- Identity cell: 32px avatar with initials fallback, name, role, department,
  expand/collapse chevron. Sticky left.

### 3.4 Layout chrome

`app/page.tsx` → `HomeClient`: `flex flex-col h-screen`; `FilterBar` (brand / department /
project / search / setup) above the timeline; toolbar with view-mode switch, prev/today/next,
weekend toggle. Toast via custom `ToastProvider`. No sidebar on the timeline page.

---

## 4. Reference direction (revised: no Runn screenshot study)

Per Sora's decision (2026-06-11): **the current UI is the visual reference** — no live Runn
study needed. Sections 2–3 above ARE the visual contract for the rebuild. Runn.io remains
the benchmark only for *experience qualities*, all expressible against the current UI:

- **Interaction quality** — drag-on-empty-lane to create, edge-resize/body-drag on bars,
  instant optimistic commits, no full-page spinners; skeletons where layout is known.
- **Editing UX** — ONE anchored popover editor for create/edit/month-distribution
  (replaces the 4 current modal surfaces); confirmation only for destructive delete.
- **Density/responsiveness feel** — expand, filter, and date paging feel instant
  (the Phase 3 performance contract, §5.5).

Visual changes allowed beyond today's baseline (each was flagged in §3, pending review):
1. Assignment bars use the project's `color` field instead of hardcoded `#2563eb` (§3.1).
2. Capacity strip rendered as one continuous heatmap row per employee instead of ~90
   bordered cells — same blue utilization ramp and % labels as §3.2.

Out of scope: charts/analytics panel, infinite horizontal scroll, zoom presets,
actuals-editing UI.

---

## 5. Target architecture (the rebuild)

### 5.1 Naming

Directory stays `components/timeline-v2/` + `lib/timeline-v2/` (it is the namespace);
**new files drop the `V2` suffix** (`Timeline.tsx`, `ResourceRow.tsx`, `getTimelineColumns`).
Existing `data-testid="timeline-v2-*"` strings are opaque ids and stay.

### 5.2 End-state file map

```
components/timeline-v2/
  index.ts  Timeline.tsx  TimelineToolbar.tsx  TimelineHeader.tsx  TimelineBody.tsx
  ResourceRow.tsx  ResourceIdentityCell.tsx  CapacityStrip.tsx  ProjectLane.tsx
  AssignmentBar.tsx  LoadingStates.tsx  DataStatus.tsx  useTimelineEditor.ts
  interactions/useDragToCreate.ts  interactions/useBarDrag.ts
  editor/AssignmentEditor.tsx  editor/MonthDistributionFields.tsx

lib/timeline-v2/
  types.ts  date-range.ts  layout.ts
  allocation-day-map.ts   # O(A+D) per-employee day→hours precompute
  allocation-model.ts     # day-map → AllocationCellModel (plan% + actual%)
  row-model.ts            # buildEmployeeRowModels — NO filter/expansion deps
  visible-rows.ts  lane-order.ts  plan-display-segments.ts  assignment-positioning.ts
  drag-model.ts  month-distribution.ts  assignment-write-service.ts
  expansion-store.ts  view-store.ts  editor-store.ts
  use-timeline-employees.ts  hours.ts  assignment-display-hours.ts

lib/planner/              # server-shared modules (moved out of lib/timeline)
  planner-loading.ts  initial-load.ts

DELETED at end: components/timeline/ (entire), lib/timeline/ (entire), all *V2 names.
```

### 5.3 State stores (zustand)

- **expansion-store** — `{ expandedIds, toggle(id), collapseAll() }` + per-row
  `useIsRowExpanded(id)` selector. Expanding one row re-renders ONE row.
- **view-store** — `{ viewMode, anchorDate, showWeekends, resourceColumnWidth }`;
  `showWeekends` hydrated from localStorage key `"showWeekends"`.
- **editor-store** — `{ target: AssignmentEditorTarget | null, open(t), close() }` where
  `AssignmentEditorTarget = create(employee, project, dateRange) | edit(assignmentId) |
  month(employee, project, monthRange, hour totals)`.

### 5.4 Editing surface

ONE lazy-loaded `AssignmentEditor` (popover) replaces `AssignmentPopover`,
`EditAssignmentDialog`, `MonthlyAllocationModal`, `MonthlyAllocationConfirmation`.
Save is immediate; the only surviving confirmation is destructive delete (AlertDialog).

### 5.5 Performance contract

- Row models depend on **data + columns + viewMode only** — never on filters or expansion.
- Allocation = one O(A+D) pass per employee (`allocation-day-map.ts`), cells read the map.
- Filter changes recompute only the visible-employee id list.
- Every grid component `React.memo` with stable props; editors lazy via `next/dynamic`.
- Layout per §2.1: Tailwind-scale classes + CSS Grid column distribution; no inline pixel
  styles except the resize CSS var and virtualizer estimates.
- 5 discrete view modes with prev/next paging are KEPT (no infinite scroll/zoom).
- Out of scope: charts/analytics panel (future), actuals editing UI (deleted).

---

## 6. Perf log

Metric: total bytes of `.next/static/chunks/*.js` after `npm run build` (Next 16/Turbopack
no longer prints a per-route size table). Same machine, same command, each phase.

| Checkpoint | Total client JS | Chunks | Largest chunk |
|---|---|---|---|
| Phase 2.1 baseline (pre-teardown, commit 7fc9ba9) | 2.4 MB | 20 | 1,203 KB |
| Phase 2.6 (dead code deleted, editors lazy-loaded) | 2.4 MB | 29 | 1,141 KB (−62 KB eager; 4 editor surfaces moved to on-demand chunks) |
| Phase 6 final (rebuild complete) | 2.43 MB | 25 | **1,127 KB eager (−76 KB / −6.3% vs baseline)**; single lazy editor chunk |

Structural wins not visible in bundle bytes (verify in Profiler): expanding a row commits
1 row instead of rebuilding every cell; search keystrokes no longer rebuild row models;
allocation math is one O(A+D) pass per data change; saves/drags no longer flash the
timeline into skeletons. Side effects of the teardown: repo tsc errors 92 → 85, repo
lint errors 103 → 91, whitebox tests 402 → 449 (only the 9 pre-existing failures remain).
