# Plan: View by Department & View by Brand

## Summary
Add "View by Department" and "View by Brand" modes to the timeline dashboard. A dropdown toggle near the "Today" button lets users switch between Employee/Department/Brand views. Department and Brand views show aggregated total hours per day and per month in non-expandable rows.

## Files to Modify

| File | Action |
|------|--------|
| `components/timeline/TimelineHeaderControls.tsx` | Add dropdown toggle for resource view |
| `components/timeline/Timeline.tsx` | Add `resourceView` state, aggregation logic, conditional rendering |
| `components/timeline/AggregatedRow.tsx` | **CREATE** - new row component for dept/brand |
| `lib/utils/hours.ts` | **CREATE** - shared `parseHoursSafe` utility |

## Task List

- [x] **Task 1: Extract `parseHoursSafe` to shared utility**
  - File: `lib/utils/hours.ts` (new)
  - Extract `parseHoursSafe` helper from `ResourceRow.tsx:76-82`

- [x] **Task 2: Add `ResourceView` type and state to `Timeline.tsx`**
  - File: `components/timeline/Timeline.tsx`
  - Add `export type ResourceView = "employee" | "department" | "brand"`
  - Add `const [resourceView, setResourceView] = useState<ResourceView>("employee")`
  - Add `useDepartments()` hook import and call
  - Pass `resourceView` and `onResourceViewChange` to `TimelineHeaderControls`

- [x] **Task 3: Add aggregation `useMemo` blocks in `Timeline.tsx`**
  - `assignmentsByDepartment` - groups `filteredAssignments` by employee's department
  - `assignmentsByBrand` - groups `filteredAssignments` by project's brand
  - Returns `Map<id, { name, color, assignments[] }>` for both

- [x] **Task 4: Add resource view dropdown to `TimelineHeaderControls.tsx`**
  - Add `resourceView` and `onResourceViewChange` props
  - Add `DropdownMenu` button after "Today" button
  - Options: "By Employee", "By Department", "By Brand"

- [x] **Task 5: Create `AggregatedRow.tsx` component**
  - File: `components/timeline/AggregatedRow.tsx` (new)
  - Sidebar: name + colored dot (not clickable)
  - Cells: total aggregated hours per day/month
  - Supports all view modes (week/month/quarter/half-year/year)
  - Blue color gradient based on hours intensity

- [x] **Task 6: Conditional body rendering in `Timeline.tsx`**
  - Employee view → `ResourceRow` (existing)
  - Department view → `AggregatedRow` with `assignmentsByDepartment`
  - Brand view → `AggregatedRow` with `assignmentsByBrand`
  - Dynamic sidebar header ("Resources" / "Departments" / "Brands")

- [x] **Task 7: Update `ResourceRow.tsx` import**
  - Change `parseHoursSafe` import to use shared `lib/utils/hours.ts`

- [x] **Task 8: Match department/brand aggregate rows to employee row styling**
  - File: `components/timeline/AggregatedRow.tsx`
  - Use the same collapsed row layout as `ResourceRow`: sidebar width, avatar area, hover state, 60px timeline cells
  - Keep department/brand rows non-expandable
  - Highlight cells with assignment total hours using blue intensity and hour labels

- [x] **Task 9: Show timeline grid lines in aggregate rows**
  - File: `components/timeline/AggregatedRow.tsx`
  - Keep visible vertical column lines for day columns in week/month views
  - Keep visible vertical column lines for month columns in quarter/half-year/year views
  - Ensure grid lines remain visible on blue highlighted total-hour cells

- [x] **Task 10: Show all brands in By Brand timeline view**
  - File: `components/timeline/Timeline.tsx`
  - Build brand aggregate rows from the full `brands` list, not only brands found in assignments
  - Keep assignment totals grouped into those brand rows
  - Preserve brand/search filters for the visible brand row list

- [x] **Task 11: Align timeline brand source with Setup Brand list**
  - File: `lib/query/hooks/useBrands.ts`
  - Fetch all brand pages for `useBrands()` so dashboard/filter consumers receive the complete Setup Brand dataset
  - File: `app/api/brands/route.ts`
  - Prevent paginated Setup Brand requests from poisoning the shared first-page cache used by other consumers

- [x] **Task 12: Keep By Brand row list unfiltered**
  - File: `components/timeline/Timeline.tsx`
  - Always render the left-side By Brand rows from the complete brand list
  - Do not remove brand rows because of search text or selected brand filter
  - Keep current assignment filters applied only to the hours shown inside each brand row

- [x] **Task 13: Show all departments in By Department timeline view**
  - File: `components/timeline/Timeline.tsx`
  - Build department aggregate rows from the full `departments` list, not only departments found in assignments
  - Do not remove department rows because of search text or selected department filter
  - Keep current assignment filters applied only to the hours shown inside each department row

## Key Design Decisions
- **No new API calls** - uses existing `useAssignments`, `useDepartments`, `useBrands` hooks
- **No capacity concept** for dept/brand - shows absolute hours, not utilization %
- **Same grid/columns** as employee view - scroll sync works automatically
- **searchQuery** in department/brand views filters by department/brand name
- **Sort** department and brand rows alphabetically by name
- **Assignments without department/brand** are excluded from respective views
- **Brand view includes empty brands** - rows come from `useBrands()`, so brands with no matching assignments still appear with 0h totals
- **Dashboard brand rows match Setup Brand source** - `useBrands()` now walks paginated `/api/brands` responses and de-duplicates by brand id
- **By Brand row list is not filtered by dashboard filters** - filters affect hour totals, not whether a brand appears on the left
- **By Department row list is not filtered by dashboard filters** - filters affect hour totals, not whether a department appears on the left

## Verification
1. Run the app and confirm the dropdown appears next to "Today" button
2. Switch to "By Department" - verify department names appear on left, hours aggregate correctly per day
3. Switch to "By Brand" - verify brand names appear on left, hours aggregate correctly
4. Verify week/month/quarter/half-year/year view modes all work with department/brand views
5. Verify clicking department/brand rows does NOT expand them
6. Switch back to "By Employee" - verify original behavior is unchanged
7. Verify existing filters (brand, department, search, project) still work in employee view
8. Verify "By Brand" shows brands even when they have no assignments in the current timeline/filter selection
9. Verify all brands visible in Setup Brand are also visible in the timeline dashboard "By Brand" view
10. Verify searching or selecting a brand in the dashboard filter does not hide other brand rows in "By Brand" view
11. Verify all departments appear in the timeline dashboard "By Department" view even when they have no assignments
