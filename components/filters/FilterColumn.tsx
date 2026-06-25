"use client";

import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FilterColumnOption = { id: string; label: string; sublabel?: string | null };

type FilterColumnProps = {
  testidPrefix: string;
  title: string;
  caption?: string | null;
  icon?: string | null;
  options: FilterColumnOption[];
  selectedIds: string[];
  // Full objects for the selected ids, so they stay pinned + visible even when
  // they're not in the current search page. Omit for always-visible checklists
  // (e.g. departments), where selections already show inline.
  selectedOptions?: FilterColumnOption[];
  onToggle: (id: string, checked: boolean) => void;
  search?: { value: string; onChange: (value: string) => void; placeholder: string } | null;
  hasQuery?: boolean;
  isLoading?: boolean;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  emptyHint?: string;
  noResults?: string;
  total?: number;
};

export function FilterColumn({
  testidPrefix, title, caption, icon, options, selectedIds, selectedOptions = [], onToggle, search,
  hasQuery = true, isLoading = false, hasMore = false, isFetchingNextPage = false,
  onLoadMore, emptyHint, noResults, total,
}: FilterColumnProps) {
  const scrollWrapRef = React.useRef<HTMLDivElement>(null);
  const onLoadMoreRef = React.useRef(onLoadMore);
  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  React.useEffect(() => {
    const viewport = scrollWrapRef.current;
    if (!viewport || !hasMore) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 160) onLoadMoreRef.current?.();
      });
    };
    viewport.addEventListener("scroll", onScroll);
    return () => { cancelAnimationFrame(raf); viewport.removeEventListener("scroll", onScroll); };
  }, [hasMore, options.length]);

  const hasSelected = selectedOptions.length > 0;
  // When we pin selected rows on top, drop them from the result list to avoid
  // showing the same item twice. For always-visible checklists (no
  // selectedOptions) keep every option so selections stay checked inline.
  const resultOptions = useMemo(
    () => (hasSelected ? options.filter((option) => !selected.has(option.id)) : options),
    [hasSelected, options, selected]
  );

  const renderRow = (option: FilterColumnOption) => {
    const checked = selected.has(option.id);
    return (
      <button
        key={option.id}
        type="button"
        title={option.sublabel ? `${option.label} — ${option.sublabel}` : option.label}
        className={cn("flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-[13px] hover:bg-accent", checked && "bg-accent")}
        onClick={() => onToggle(option.id, !checked)}
        data-testid={`${testidPrefix}-option`}
      >
        <span className={cn("flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border", checked ? "border-primary bg-primary" : "border-muted-foreground/40")}>
          {checked ? <Icon icon="lucide:check" className="h-2.5 w-2.5 text-primary-foreground" /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {option.sublabel ? <span className="ml-auto max-w-[45%] shrink-0 truncate pl-2 text-[11px] text-muted-foreground">{option.sublabel}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid={`${testidPrefix}-column`}>
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon ? <Icon icon={icon} className="h-3.5 w-3.5" /> : null}{title}
        </span>
        {caption ? <span className="truncate pl-2 text-[10px] text-muted-foreground/80">{caption}</span> : null}
      </div>

      {search ? (
        <div className="relative px-2 pb-1.5">
          <Icon icon="lucide:search" className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            className="h-8 pl-7 text-[13px]"
            data-testid={`${testidPrefix}-search-input`}
          />
        </div>
      ) : null}

      <div ref={scrollWrapRef} className="min-h-0 flex-1 overflow-y-auto">
        {!hasSelected && !hasQuery ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-[13px] text-muted-foreground">{emptyHint}</div>
        ) : (
          <div className="p-1">
            {hasSelected ? (
              <>
                {selectedOptions.map((option) => renderRow(option))}
                <div className="my-1 border-t border-border/60" data-testid={`${testidPrefix}-selected-divider`} />
              </>
            ) : null}

            {!hasQuery ? (
              hasSelected ? <div className="px-2 py-1.5 text-[12px] text-muted-foreground">{emptyHint}</div> : null
            ) : isLoading && resultOptions.length === 0 ? (
              <div className="px-2 py-2 text-center text-[12px] text-muted-foreground">Searching…</div>
            ) : resultOptions.length === 0 ? (
              <div className="px-2 py-2 text-center text-[12px] text-muted-foreground">{noResults}</div>
            ) : (
              <>
                {resultOptions.map((option) => renderRow(option))}
                {isFetchingNextPage ? (
                  <div className="px-2 py-2 text-center text-[11px] text-muted-foreground" data-testid={`${testidPrefix}-loading-more`}>Loading more…</div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {typeof total === "number" && options.length > 0 ? (
        <div className="px-2.5 pb-1.5 pt-1 text-[10px] text-muted-foreground">{options.length} of {total}</div>
      ) : null}
    </div>
  );
}
