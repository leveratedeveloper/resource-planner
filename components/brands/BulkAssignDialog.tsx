"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useInfiniteEmployees, type Employee } from "@/lib/query/hooks/useEmployees";
import { useProjectsByBrand, type ProjectOption } from "@/lib/query/hooks/useProjects";
import { useAssignmentCommands } from "@/lib/query/hooks/useAssignmentCommands";
import { splitTotalAcrossMonths, parseManHoursInput } from "@/lib/assignments/split";

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
}

/** Derive a span from a ProjectOption.
 *  - campaign: use startDate + endDate when both are present.
 *  - pitch: ProjectOption has no submitDate, so fall back to startDate (if present) as a
 *    single-day span. If neither is available the project is skipped.
 */
function deriveSpan(p: ProjectOption): { startDate: string; endDate: string } | null {
  if (p.projectType === "campaign") {
    if (p.startDate && p.endDate) return { startDate: p.startDate, endDate: p.endDate };
    return null;
  }
  // pitch — ProjectOption does not carry submitDate, use startDate as proxy if present
  if (p.startDate) return { startDate: p.startDate, endDate: p.startDate };
  return null;
}

export const BulkAssignDialog: React.FC<BulkAssignDialogProps> = ({
  open,
  onOpenChange,
  brandId,
  brandName,
}) => {
  // ── Project list ──────────────────────────────────────────────────────────
  const { data: brandProjects = [], isLoading: isLoadingProjects } = useProjectsByBrand(brandId);

  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) =>
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedProjects = useMemo(
    () => brandProjects.filter((p) => selectedProjectIds.has(p.id)),
    [brandProjects, selectedProjectIds],
  );

  // How many of the selected projects will be skipped at commit time
  const skippedCount = useMemo(
    () => selectedProjects.filter((p) => !deriveSpan(p)).length,
    [selectedProjects],
  );

  // ── Member search + infinite list ─────────────────────────────────────────
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const {
    data: employeesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingEmployees,
  } = useInfiniteEmployees(debouncedSearch, { enabled: open });

  const employees = useMemo(() => {
    if (!employeesData?.pages) return [];
    return employeesData.pages.flatMap((page) => page.data);
  }, [employeesData]);

  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const toggleMember = (id: string) =>
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedMembers = useMemo(
    () => employees.filter((e) => selectedMemberIds.has(e.id)),
    [employees, selectedMemberIds],
  );

  // ── Per-member man-hours ──────────────────────────────────────────────────
  const [manHoursByMember, setManHoursByMember] = useState<Record<string, string>>({});

  const setManHours = (memberId: string, value: string) =>
    setManHoursByMember((prev) => ({ ...prev, [memberId]: value }));

  // ── Infinite scroll sentinel ──────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const loadMoreElement = loadMoreRef.current;
    if (!scrollContainer || !loadMoreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { root: scrollContainer, threshold: 0.1, rootMargin: "100px" },
    );
    observer.observe(loadMoreElement);
    return () => observer.unobserve(loadMoreElement);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Reset on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setSelectedProjectIds(new Set());
      setSelectedMemberIds(new Set());
      setManHoursByMember({});
      setSearch("");
    }
  }, [open]);

  // ── Commit ────────────────────────────────────────────────────────────────
  const { upsert } = useAssignmentCommands();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totalAssignments = selectedMembers.length * (selectedProjects.length - skippedCount);

  const commit = useCallback(async () => {
    if (selectedMembers.length === 0 || selectedProjects.length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const ops: Promise<unknown>[] = [];
      for (const m of selectedMembers) {
        const total = parseManHoursInput(manHoursByMember[m.id]) ?? 0;
        for (const p of selectedProjects) {
          const span = deriveSpan(p);
          if (!span) continue; // skipped — no usable dates
          const monthlyHours = Object.fromEntries(
            splitTotalAcrossMonths(total, span.startDate, span.endDate).map((x) => [
              x.month,
              x.plannedHours,
            ]),
          );
          ops.push(
            upsert.mutateAsync({
              employeeUuid: m.id,
              projectKey: p.projectKey,
              span,
              monthlyHours,
              status: "draft",
              mode: "merge",
            }),
          );
        }
      }
      await Promise.all(ops);
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save assignments");
    } finally {
      setIsSaving(false);
    }
  }, [selectedMembers, selectedProjects, manHoursByMember, upsert, onOpenChange]);

  const canSave =
    selectedMembers.length > 0 &&
    selectedProjects.length > 0 &&
    selectedProjects.length > skippedCount &&
    !isSaving;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Bulk Assign — {brandName}</DialogTitle>
          <DialogDescription>
            Select projects and team members, then set man-hours per member. All combinations will
            be created as draft assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* ── Project checklist ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Projects{" "}
              <span className="text-muted-foreground font-normal">
                ({selectedProjectIds.size} selected)
              </span>
            </h3>
            {isLoadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                Loading projects…
              </div>
            ) : brandProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No projects found for this brand.
              </p>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1 pr-2">
                  {brandProjects.map((p) => {
                    const isSelected = selectedProjectIds.has(p.id);
                    const span = deriveSpan(p);
                    const noDate = !span;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : noDate
                              ? "border-amber-200 bg-amber-50/50 opacity-70"
                              : "hover:bg-accent/50 border-transparent",
                        )}
                        onClick={() => toggleProject(p.id)}
                      >
                        {/* Color swatch */}
                        <div
                          className="w-2 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.projectType === "pitch" ? "Pitch" : "Campaign"}
                            {span
                              ? ` · ${span.startDate} – ${span.endDate}`
                              : " · no dates — will be skipped"}
                          </div>
                        </div>
                        {/* Checkbox */}
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary border-primary" : "border-gray-300",
                          )}
                        >
                          {isSelected && (
                            <Icon icon="lucide:check" className="h-3 w-3 text-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </section>

          {/* ── Member selector ────────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Team Members{" "}
              <span className="text-muted-foreground font-normal">
                ({selectedMemberIds.size} selected)
              </span>
            </h3>
            <div className="relative mb-2">
              <Icon
                icon="lucide:search"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                placeholder="Search employees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div ref={scrollContainerRef} className="max-h-[260px] overflow-y-auto space-y-1">
              {isLoadingEmployees && employees.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border animate-pulse"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : employees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {search ? `No employees matching "${search}"` : "No employees found"}
                </p>
              ) : (
                <>
                  {employees.map((emp) => {
                    const isSelected = selectedMemberIds.has(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-accent/50 border-transparent",
                        )}
                        onClick={() => toggleMember(emp.id)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0"
                          style={{ backgroundColor: emp.department?.color ?? "#6366f1" }}
                        >
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {emp.position}
                            {emp.department && ` · ${emp.department.name}`}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary border-primary" : "border-gray-300",
                          )}
                        >
                          {isSelected && (
                            <Icon icon="lucide:check" className="h-3 w-3 text-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={loadMoreRef} className="py-2 text-center text-xs text-muted-foreground">
                    {isFetchingNextPage ? (
                      <span className="flex items-center justify-center gap-1">
                        <Icon icon="lucide:loader-2" className="h-3 w-3 animate-spin" />
                        Loading more…
                      </span>
                    ) : hasNextPage ? (
                      "Scroll to load more"
                    ) : employees.length > 0 ? (
                      `${employees.length} employee${employees.length !== 1 ? "s" : ""} shown`
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Per-member man-hours ────────────────────────────────────────── */}
          {selectedMembers.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Man-Hours per Member</h3>
              <div className="space-y-2">
                {selectedMembers.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                      style={{ backgroundColor: emp.department?.color ?? "#6366f1" }}
                    >
                      {emp.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm flex-1 truncate">{emp.fullName}</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manHoursByMember[emp.id] ?? ""}
                      onChange={(e) => setManHours(emp.id, e.target.value)}
                      className="w-24 text-right"
                    />
                    <span className="text-xs text-muted-foreground w-6">hrs</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Summary line ───────────────────────────────────────────────── */}
          {(selectedMembers.length > 0 || selectedProjects.length > 0) && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
              <p className="font-medium">
                {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} ×{" "}
                {selectedProjects.length - skippedCount} project
                {selectedProjects.length - skippedCount !== 1 ? "s" : ""} ={" "}
                <span className="text-primary font-semibold">{totalAssignments} assignment{totalAssignments !== 1 ? "s" : ""}</span>
              </p>
              {skippedCount > 0 && (
                <p className="text-amber-600 text-xs">
                  ({skippedCount} project{skippedCount !== 1 ? "s" : ""} skipped — no usable dates)
                </p>
              )}
            </div>
          )}

          {saveError && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <Icon icon="lucide:alert-circle" className="h-4 w-4 shrink-0" />
              {saveError}
            </p>
          )}
        </div>

        <DialogFooter className="pt-4 border-t mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={!canSave}>
            {isSaving ? (
              <>
                <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Icon icon="lucide:users" className="h-4 w-4 mr-1" />
                Save {totalAssignments > 0 ? `(${totalAssignments})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
