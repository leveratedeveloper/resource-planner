# Resource Planner - Design System Documentation

## 1. Product Design Overview

Resource Planner uses a clean, data-first interface optimized for dense operational workflows (resource allocation, timeline planning, setup management, and AI insights).

Core characteristics:
- Neutral, low-chroma base palette with semantic accents.
- Compact controls with consistent heights (`h-8`/`h-9`) for fast scanning.
- Strong structural separation using borders, cards, and sticky timeline headers.
- Utility-first styling with Tailwind tokens mapped to CSS variables in `app/globals.css`.

Primary UX priorities:
- Readability of schedule data at scale.
- Fast filter and navigation operations.
- Clear visual status through color-coded workload blocks and badges.

## 2. Theme & Design Tokens

Theme tokens are declared in `app/globals.css` using CSS custom properties and mapped into Tailwind via `@theme inline`.

### 2.1 Color System

Base semantic tokens:
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`
- `--border`, `--input`, `--ring`

Additional token groups:
- Chart palette: `--chart-1` through `--chart-5`
- Sidebar palette: `--sidebar-*`

Color model:
- Uses `oklch(...)` values for modern perceptual consistency.
- Includes full dark theme overrides under `.dark`.

Usage pattern:
- Surfaces: `bg-background`, `bg-card`, `bg-muted/40`
- Text hierarchy: `text-foreground`, `text-muted-foreground`
- States: `bg-primary`, `bg-destructive`, `focus-visible:ring-ring/50`

### 2.2 Radius System

Radius token:
- Base radius: `--radius: 0.625rem`

Derived radii:
- `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`, `--radius-4xl`

Common component usage:
- Inputs/buttons/selects: `rounded-md`
- Cards: `rounded-xl`
- Pills/badges: `rounded-full`

### 2.3 Typography

Font families:
- Sans: Geist (`public/fonts/geist/geist-latin.woff2`)
- Mono: Geist Mono (`public/fonts/geist/geist-mono-latin.woff2`)

Global typography behavior:
- Applied via root layout font variables and `antialiased` body class.
- Primary UI text scale centers around `text-sm` and `text-base`.
- Data labels and metadata use `text-xs` with muted colors.

## 3. Spacing, Sizing & Density

Design density is compact-professional and tuned for data tools.

Key spacing conventions:
- Container paddings: `p-4`, `px-4 py-2`, `p-6`
- Gaps: `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`
- Control heights: `h-8`, `h-9`, `h-10`

Layout constants:
- Timeline resource column: fixed `w-[250px]`
- Insights side panel: `max-w-md`
- Setup dialog: `h-[90vh]`

## 4. Layout Architecture

## 4.1 App Shell

Main page structure (`app/page.tsx`):
- Vertical shell: `flex flex-col h-screen bg-background`
- Top utility/filter bar (`FilterBar`) with border separation.
- Main content region (`main.flex-1`) with overflow management.
- Layered overlays: setup dialog and right-side insights panel.

## 4.2 Timeline Layout

Timeline (`components/timeline/Timeline.tsx`) is the dominant workspace:
- Sticky header row with synchronized horizontal scroll.
- Fixed resource identity column and horizontally scrolling time grid.
- Responsive cell width computed from available container width.
- Loading and empty-state handling integrated in primary content zone.

## 4.3 Modal & Drawer Patterns

Two overlay patterns are used:
- Center modal (`Dialog`) for setup and forms.
- Right slide-over panel (`InsightsPanel`) for analysis workflows.

Both patterns include:
- Layered backdrop.
- Strong border/shadow separation.
- Keyboard support (`Escape` close) and controlled scroll behavior.

## 5. Component Design Language

## 5.1 Buttons

`components/ui/button.tsx` uses CVA variants:
- Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`

Interaction standards:
- Visible focus ring with `focus-visible:ring-[3px]`
- Disabled state with reduced opacity and pointer blocking
- Icon sizing normalized to `size-4`

## 5.2 Inputs & Selects

Form controls (`Input`, `SelectTrigger`) are consistent:
- Height baseline: `h-9`
- Border token: `border-input`
- Focus: ring + border promotion to `ring` token
- Placeholder: muted foreground token

This provides uniform rhythm across search, filter, and auth forms.

## 5.3 Cards

Cards are the default content containers:
- Background: `bg-card`
- Border + soft elevation (`shadow-sm`)
- Rounded `xl` corners
- Internal spacing via header/content/footer paddings (`px-6`, `py-6`)

## 5.4 Tabs

Tabs are compact and segmented:
- Container: muted rounded strip (`h-9`)
- Active state: `bg-background` + subtle shadow
- Suitable for dense panel switching (e.g., Capacity/Conflicts/Forecast)

## 5.5 Status & Data Blocks

Timeline and allocation visuals provide domain-specific status:
- Planned work: blue intensity scaling by utilization percentage
- Over-capacity: red accent border
- Time-off states: neutral gray full-cell treatment

This makes workload health scannable without opening details.

## 6. Visual Style Principles

Current style principles expressed in code:
- Neutral-first foundation: most surfaces rely on grayscale tokens.
- Accent by intent: stronger colors reserved for actions, warnings, and schedule states.
- Border-defined structure: frequent use of borders for separation in dense grids.
- Motion restraint: short duration transitions and simple slide/fade behaviors.
- Information clarity over decoration.

## 7. Accessibility & Interaction Notes

Implemented strengths:
- Focus-visible rings across core interactive primitives.
- ARIA labels on icon-only and key control buttons in timeline/insights.
- Semantic labels on login form inputs.

Areas to standardize further:
- Keep ellipsis style consistent (`…` instead of `...`) in all loading labels.
- Ensure all icon-only controls across feature components include explicit `aria-label`.
- Continue avoiding focus suppression unless replaced with visible focus treatment.

## 8. Internal Guidelines for Future UI Work

To maintain design consistency in this project:
- Use semantic theme tokens (`bg-card`, `text-muted-foreground`, etc.) instead of hardcoded colors for general UI surfaces.
- Keep compact control heights (`h-8`/`h-9`) unless a larger target is intentionally required.
- Prefer card, dialog, and tab primitives from `components/ui/*` before creating one-off patterns.
- Preserve timeline structural constants (sticky headers, fixed resource column) to protect planning usability.
- Introduce new color encodings only with semantic meaning and clear legend/context.

## 9. Source of Truth

Primary implementation references:
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/login/page.tsx`
- `components/filters/FilterBar.tsx`
- `components/timeline/Timeline.tsx`
- `components/timeline/TimelineHeaderControls.tsx`
- `components/timeline/ResourceRow.tsx`
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/tabs.tsx`
- `components/ui/badge.tsx`
