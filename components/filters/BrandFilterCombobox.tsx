"use client";

import React, { useMemo, useState } from "react";
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
  brandHasMore: boolean;
  isLoading: boolean;
  onChange: (brandId: string | null) => void;
  onBrandSearchChange: (search: string) => void;
  onLoadMoreBrands: () => void;
};

export function BrandFilterCombobox({
  value,
  brands,
  selectedBrand,
  brandSearch,
  brandTotal,
  brandHasMore,
  isLoading,
  onChange,
  onBrandSearchChange,
  onLoadMoreBrands,
}: BrandFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => selectedBrand ?? brands.find((brand) => brand.id === value) ?? null,
    [brands, selectedBrand, value]
  );

  const renderedBrands = useMemo(() => {
    const byId = new Map<string, Brand>();
    if (selected) {
      byId.set(selected.id, selected);
    }
    for (const brand of brands) {
      if (!byId.has(brand.id)) {
        byId.set(brand.id, brand);
      }
    }
    return Array.from(byId.values());
  }, [brands, selected]);

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

              {renderedBrands.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  className={cn(
                    "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-sm px-2 text-left text-sm hover:bg-accent",
                    value === brand.id && "bg-accent"
                  )}
                  onClick={() => {
                    onChange(brand.id);
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

              {renderedBrands.length === 0 && !isLoading ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No brands found
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{isLoading ? "Loading..." : `${renderedBrands.length} of ${brandTotal} brands`}</span>
            {brandHasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onLoadMoreBrands}
                disabled={isLoading}
                data-testid="filter-brand-load-more"
              >
                Load more
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
