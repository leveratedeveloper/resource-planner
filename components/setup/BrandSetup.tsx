"use client";

import React, { useState, useEffect } from "react";
import { useBrands, useCreateBrand, useUpdateBrand, type Brand } from "@/lib/query/hooks/useBrands";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const { sentinelRef, isStuck } = useIsStuck(40);

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

  // Auto-generate client code when creating new brand
  useEffect(() => {
    if (!editingBrand && name) {
      const existingCodes = brands.map(b => b.clientCode).filter(Boolean) as string[];
      const newCode = generateClientCode(name, existingCodes);
      setClientCode(newCode);
    }
  }, [name, editingBrand, brands]);

  const handleOpen = (brand?: Brand) => {
    if (brand) {
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
    } else {
      setEditingBrand(null);
      setCompanyName("");
      setName("");
      setBrandAddress("");
      setClientCode("");
      setIndustryCategory("");
      setLogo("");
      setWebsite("");
      setColor("#3b82f6");
      setStatus("active");
      setContactName("");
      setContactTitle("");
      setContactEmail("");
      setContactPhone("");
      setPicFinanceName("");
      setPicFinancePhone("");
      setBusinessUnitId("");
      setDescription("");
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const brandData = {
      companyName: companyName || null,
      name,
      brandAddress: brandAddress || null,
      clientCode: clientCode || null,
      industryCategory: industryCategory || null,
      logo: logo || null,
      website: website || null,
      color,
      status,
      contactName: contactName || null,
      contactTitle: contactTitle || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      picFinanceName: picFinanceName || null,
      picFinancePhone: picFinancePhone || null,
      businessUnitId: businessUnitId || null,
      description: description || null,
    };

    if (editingBrand) {
      // Update existing brand
      updateBrand.mutate({
        id: editingBrand.id,
        ...brandData,
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
        }
      });
    } else {
      // Create new brand
      createBrand.mutate(brandData, {
        onSuccess: () => {
          setIsDialogOpen(false);
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div ref={sentinelRef} className="h-px -mt-px invisible" />
      <div className={cn("sticky top-10 z-10 bg-background py-3 px-2 flex justify-between items-center mb-6 transition-shadow duration-200", isStuck && "shadow-sm")}>
        <h2 className="text-xl font-bold tracking-tight">Brand Management</h2>
        <Button onClick={() => handleOpen()} className="bg-black text-white hover:bg-gray-800 rounded-md">
          <Icon icon="lucide:plus" className="mr-2 h-4 w-4" /> Add Brand
        </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brands.map((brand) => {
            return (
              <Card key={brand.id} className="hover:shadow-lg transition-all border rounded-xl overflow-hidden">
                <CardHeader className="pb-2 pt-6 px-6">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-8 rounded-full" style={{ backgroundColor: brand.color, width: '8px', height: '24px', borderRadius: '999px' }} />
                       <CardTitle className="text-lg font-bold flex items-center gap-2">
                         {brand.name}
                         <button onClick={() => handleOpen(brand)} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                            <Icon icon="lucide:pencil" className="h-4 w-4" />
                         </button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Create New Brand"}</DialogTitle>
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
                    onChange={(e) => setCompanyName(e.target.value)}
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
                    onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setBrandAddress(e.target.value)}
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
                  <Select value={industryCategory} onValueChange={setIndustryCategory}>
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

                      {/* Camera Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              // For now, show a message about uploading to a service
                              // In production, you'd upload to your storage service here
                              alert('Please upload your image to a hosting service (Imgur, Cloudinary, etc.) and paste the URL below, or use the URL input field directly.');
                            }
                          };
                          input.click();
                        }}
                        className="absolute bottom-1 right-1 w-9 h-9 bg-gray-700 hover:bg-gray-800 rounded-full flex items-center justify-center shadow-md transition-colors"
                      >
                        <Icon icon="lucide:camera" className="w-4 h-4 text-white" />
                      </button>
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
                          onChange={(e) => setLogo(e.target.value)}
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
                    onChange={(e) => setWebsite(e.target.value)}
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
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <span className="text-sm text-muted-foreground">{color}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium">
                    Status
                  </label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
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
                    onChange={(e) => setContactName(e.target.value)}
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
                    onChange={(e) => setContactTitle(e.target.value)}
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
                    onChange={(e) => setContactEmail(e.target.value)}
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
                    onChange={(e) => setContactPhone(e.target.value)}
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
                    onChange={(e) => setPicFinanceName(e.target.value)}
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
                    onChange={(e) => setPicFinancePhone(e.target.value)}
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
                  <Select value={businessUnitId} onValueChange={setBusinessUnitId}>
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
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional notes about the brand"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createBrand.isPending || updateBrand.isPending || !name}
            >
              {createBrand.isPending || updateBrand.isPending ? "Saving..." : "Save Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
