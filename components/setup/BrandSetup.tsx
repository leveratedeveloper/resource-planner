"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useBrands, useInfiniteBrands, type Brand } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@iconify/react";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { cn } from "@/lib/utils";
const INDUSTRY_CATEGORIES = [
  "Agriculture",
  "Airline",
  "Automotive",
  "B2B",
  "Banking",
  "Beauty",
  "Construction",
  "Consumer Electronic/ Gadget",
  "Education",
  "Energy",
  "Entertainment",
  "Event",
  "F&B",
  "Fashion & Apparel",
  "FMCG",
  "Financial Services",
  "Gaming",
  "Government",
  "Healthcare",
  "Home & Living",
  "Hospitality & Tourism",
  "Insurance",
  "Manufacturing",
  "Media & Advertising",
  "Mining/ Oil & Gas",
  "Nonprofit / Association",
  "Online Services/ Mobile App",
  "Other",
  "Personal Care",
  "Pharmaceutical",
  "Property & Real Estate",
  "Recreation",
  "Retail",
  "Sports",
  "Technology",
  "Telecommunication & ISP",
  "Tobacco",
  "Transportation & Logistic",
];

// Generate client code from brand name
const generateClientCode = (brandName: string, existingCodes: string[] = []): string => {
  if (!brandName) return "";

  // Create base code from first 3-4 letters of brand name
  const cleanName = brandName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  let baseCode = cleanName.substring(0, 4);

  // If code exists, append a number
  let code = baseCode;
  let counter = 1;
  while (existingCodes.includes(code)) {
    code = `${baseCode}${counter}`;
    counter++;
  }

  return code;
};

export const BrandSetup = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const {
    data: brandsData,
    isLoading: brandsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteBrands(debouncedSearch || undefined);
  const { data: businessUnits = [] } = useBusinessUnits();
  const { sentinelRef, isStuck } = useIsStuck(40);

  // Flatten all pages into a single array of brands and deduplicate by id
  const brands = useMemo(() => {
    if (!brandsData?.pages) return [];

    console.log('[BrandSetup] Processing brands data:', {
      pageCount: brandsData.pages.length,
      pages: brandsData.pages.map(p => ({ dataLength: p.data?.length, total: p.total, hasMore: p.hasMore })),
    });

    const allBrands = brandsData.pages.flatMap((page) => page.data || []);

    console.log('[BrandSetup] Flattened brands:', { count: allBrands.length, brands: allBrands.slice(0, 3) });

    // Deduplicate by id to handle cases where the API returns duplicate brands
    const uniqueBrandsMap = new Map<string, Brand>();
    for (const brand of allBrands) {
      if (brand.id && !uniqueBrandsMap.has(brand.id)) {
        uniqueBrandsMap.set(brand.id, brand);
      }
    }

    const result = Array.from(uniqueBrandsMap.values());
    console.log('[BrandSetup] Final brands after deduplication:', { count: result.length });

    return result;
  }, [brandsData]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // Form State - Basic Information
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [brandAddress, setBrandAddress] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [industryCategory, setIndustryCategory] = useState("");
  const [logo, setLogo] = useState("");
  const [website, setWebsite] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [status, setStatus] = useState<"active" | "inactive" | "prospect">("active");

  // Form State - Contact Information
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Form State - Finance Contact
  const [picFinanceName, setPicFinanceName] = useState("");
  const [picFinancePhone, setPicFinancePhone] = useState("");

  // Form State - Additional
  const [businessUnitId, setBusinessUnitId] = useState<string>("");
  const [description, setDescription] = useState("");

  const handleOpenView = (brand: Brand) => {
    setEditingBrand(brand);
    setCompanyName(brand.companyName || "");
    setName(brand.name);
    setBrandAddress(brand.brandAddress || "");
    setClientCode(brand.clientCode || "");
    setIndustryCategory(brand.industryCategory || "");
    setLogo(brand.logo || "");
    setWebsite(brand.website || "");
    setColor(brand.color);
    setStatus(brand.status);
    setContactName(brand.contactName || "");
    setContactTitle(brand.contactTitle || "");
    setContactEmail(brand.contactEmail || "");
    setContactPhone(brand.contactPhone || "");
    setPicFinanceName(brand.picFinanceName || "");
    setPicFinancePhone(brand.picFinancePhone || "");
    setBusinessUnitId(brand.businessUnitId || "");
    setDescription(brand.description || "");
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div ref={sentinelRef} className="h-px -mt-px invisible" />
      <div className={cn("sticky top-10 z-10 bg-background py-3 px-2 flex justify-between items-center mb-6 transition-shadow duration-200", isStuck && "shadow-sm")}>
        <h2 className="text-xl font-bold tracking-tight">Brand Management</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="brand-search-input"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {brandsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-xl p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-2 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Icon icon="lucide:package" className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Brands Found</h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery ? "No brands match your search criteria. Try a different search term." : "No brands are available in the system yet."}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {brands.map((brand) => {
              return (
                <Card key={brand.id} onClick={() => handleOpenView(brand)} className="hover:shadow-lg transition-all border rounded-xl overflow-hidden cursor-pointer hover:bg-accent/50">
                  <CardHeader className="pb-2 pt-6 px-6">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-3">
                         <div className="w-3 h-8 rounded-full" style={{ backgroundColor: brand.color, width: '8px', height: '24px', borderRadius: '999px' }} />
                         <CardTitle className="text-lg font-bold flex items-center gap-2">
                           {brand.name}
                         </CardTitle>
                      </div>
                    </div>
                    <CardDescription className="text-muted-foreground mt-2">
                      {brand.companyName || "No company name"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="space-y-2 text-sm">
                      {brand.contactName && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon icon="lucide:user" className="h-4 w-4" />
                          <span>{brand.contactName}</span>
                        </div>
                      )}
                      {brand.contactEmail && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon icon="lucide:mail" className="h-4 w-4" />
                          <span>{brand.contactEmail}</span>
                        </div>
                      )}
                      {brand.website && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon icon="lucide:globe" className="h-4 w-4" />
                          <span className="truncate">{brand.website}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
          <InfiniteScrollTrigger
            onLoadMore={handleLoadMore}
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            skeletonCount={2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {[1, 2].map((i) => (
                <div key={i} className="border rounded-xl p-6 space-y-4">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-2 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </InfiniteScrollTrigger>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Brand Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="companyName" className="text-sm font-medium">
                    Company Name
                  </label>
                  <Input
                    id="companyName"
                    value={companyName}
                    disabled
                    placeholder="e.g., PT KAO Indonesia"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Brand Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    value={name}
                    disabled
                    placeholder="e.g., MERRIES"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="brandAddress" className="text-sm font-medium">
                    Brand Address
                  </label>
                  <Textarea
                    id="brandAddress"
                    value={brandAddress}
                    disabled
                    placeholder="Physical address"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="clientCode" className="text-sm font-medium">
                    Client Code <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                  </label>
                  <Input
                    id="clientCode"
                    value={clientCode}
                    readOnly
                    disabled
                    className="bg-muted cursor-not-allowed"
                    placeholder="Auto-generated from brand name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="industryCategory" className="text-sm font-medium">
                    Industry Category
                  </label>
                  <Select value={industryCategory} disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium">Brand Logo</label>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Logo Preview Circle */}
                    <div className="relative shrink-0">
                      <div className="w-36 h-36 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                        {logo ? (
                          <img
                            src={logo}
                            alt="Brand logo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/logo.jpg';
                            }}
                          />
                        ) : (
                          <img
                            src="/logo.jpg"
                            alt="Logo placeholder"
                            className="w-full h-full object-contain p-4 opacity-50"
                          />
                        )}
                      </div>

                    </div>

                    {/* URL Input Option */}
                    <div className="flex-1 w-full flex flex-col justify-center">
                      <div className="space-y-2">
                        <label htmlFor="logo" className="text-sm font-medium">
                          Or enter image URL
                        </label>
                        <Input
                          id="logo"
                          value={logo}
                          disabled
                          placeholder="https://example.com/logo.png"
                        />
                        <p className="text-xs text-muted-foreground">
                          Paste a direct link to your logo image (PNG, JPG, SVG)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="website" className="text-sm font-medium">
                    Website
                  </label>
                  <Input
                    id="website"
                    value={website}
                    disabled
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="color" className="text-sm font-medium">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      id="color"
                      value={color}
                      disabled
                      className="w-12 h-10 p-1"
                    />
                    <span className="text-sm text-muted-foreground">{color}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium">
                    Status
                  </label>
                  <Select value={status} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Brand Contact Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Brand Contact</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="contactName" className="text-sm font-medium">
                    Contact Name
                  </label>
                  <Input
                    id="contactName"
                    value={contactName}
                    disabled
                    placeholder="Full name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contactTitle" className="text-sm font-medium">
                    Contact Title
                  </label>
                  <Input
                    id="contactTitle"
                    value={contactTitle}
                    disabled
                    placeholder="Job title"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contactEmail" className="text-sm font-medium">
                    Contact Email
                  </label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    disabled
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contactPhone" className="text-sm font-medium">
                    Contact Phone
                  </label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    disabled
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </div>

            {/* Finance Contact Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Finance Contact</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="picFinanceName" className="text-sm font-medium">
                    Finance Contact Name
                  </label>
                  <Input
                    id="picFinanceName"
                    value={picFinanceName}
                    disabled
                    placeholder="Finance person name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="picFinancePhone" className="text-sm font-medium">
                    Finance Contact Phone
                  </label>
                  <Input
                    id="picFinancePhone"
                    value={picFinancePhone}
                    disabled
                    placeholder="Finance contact phone"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Additional Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="businessUnit" className="text-sm font-medium">
                    Business Unit
                  </label>
                  <Select value={businessUnitId} disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    disabled
                    placeholder="Additional notes about the brand"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
