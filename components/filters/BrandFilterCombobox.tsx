"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Brand } from "@/lib/query/hooks/useBrands";
import { cn } from "@/lib/utils";

type BrandFilterComboboxProps = {
  value: string | null;
  brands: Brand[];
  selectedBrand: Brand | null;
  brandSearch: string;
  brandTotal: number;
  isLoading: boolean;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onChange: (brand: Brand | null) => void;
  onBrandSearchChange: (search: string) => void;
  hasQuery: boolean;
};

export function BrandFilterCombobox({
  value,
  brands,
  selectedBrand,
  brandSearch,
  brandTotal,
  isLoading,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  onChange,
  onBrandSearchChange,
  hasQuery,
}: BrandFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => selectedBrand ?? brands.find((brand) => brand.id === value) ?? null,
    [brands, selectedBrand, value]
  );

  // Search-first: results are the server page union only. The selected brand
  // shows in the trigger label (persistence) and renders checked here only when
  // it is itself a search match — the empty/open view shows the hint, never the
  // selection. No client-side filtering: search is server-driven (debounced).
  // `hasQuery` is derived once in HomeClient (see hasBrandCriteria) and passed
  // in so it always matches the hook's `enabled` gate.
  const renderedBrands = useMemo(() => {
    const byId = new Map<string, Brand>();
    for (const brand of brands) {
      if (!byId.has(brand.id)) {
        byId.set(brand.id, brand);
      }
    }
    return Array.from(byId.values());
  }, [brands]);

  // Auto-load the next page near the bottom of the Radix ScrollArea viewport.
  // A scroll listener on the viewport is deterministic; a document-rooted
  // IntersectionObserver never sees the sentinel because the viewport clips its
  // overflow, and a viewport-rooted observer is racy against effect re-attach.
  // The latest onLoadMore closure is captured via a ref so the listener stays
  // attached across renders instead of tearing down each time.
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  useEffect(() => {
    if (!open || !hasMore) return;
    let raf = 0;
    let detach = () => {};
    // The Radix viewport mounts asynchronously into the popover portal, so it
    // isn't in the DOM on the effect's first run — retry via rAF until it is.
    const attach = () => {
      const viewport = scrollWrapRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null;
      if (!viewport) {
        raf = requestAnimationFrame(attach);
        return;
      }
      const handleScroll = () => {
        if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 160) {
          onLoadMoreRef.current();
        }
      };
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      detach = () => viewport.removeEventListener("scroll", handleScroll);
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, [open, hasMore]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full min-w-[170px] max-w-[250px] justify-between sm:w-auto"
          data-testid="filter-brand-trigger"
          aria-label="Filter by brand"
        >
          <span className="min-w-0 truncate">{selected ? selected.name : "All Brands"}</span>
          <Icon icon="lucide:chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-2">
        <div className="space-y-2">
          <div className="relative">
            <Icon icon="lucide:search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={brandSearch}
              onChange={(event) => onBrandSearchChange(event.target.value)}
              placeholder="Search brands..."
              className="h-9 pl-9"
              data-testid="filter-brand-search-input"
            />
          </div>

          <div ref={scrollWrapRef}>
          <ScrollArea className="h-[280px] rounded-md border">
            <div className="p-1">
              <button
                type="button"
                className={cn(
                  "flex h-8 w-full items-center justify-between rounded-sm px-2 text-left text-sm hover:bg-accent",
                  value === null && "bg-accent"
                )}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span>All Brands</span>
              </button>

              {!hasQuery ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Type to search brands…
                </div>
              ) : (
                <>
                  {renderedBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      className={cn(
                        "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-sm px-2 text-left text-sm hover:bg-accent",
                        value === brand.id && "bg-accent"
                      )}
                      onClick={() => {
                        onChange(brand);
                        setOpen(false);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: brand.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{brand.name}</span>
                          {brand.companyName ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {brand.companyName}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  ))}

                  {renderedBrands.length === 0 && isLoading ? (
                    <div
                      className="px-2 py-6 text-center text-sm text-muted-foreground"
                      data-testid="filter-brand-searching"
                    >
                      Searching…
                    </div>
                  ) : null}
                  {renderedBrands.length === 0 && !isLoading ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No brands found
                    </div>
                  ) : null}

                  {isFetchingNextPage ? (
                    <div
                      className="px-2 py-2 text-center text-xs text-muted-foreground"
                      data-testid="filter-brand-loading-more"
                    >
                      Loading more…
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
          </div>

          {hasQuery && renderedBrands.length > 0 ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{`${renderedBrands.length} of ${brandTotal} brands`}</span>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
