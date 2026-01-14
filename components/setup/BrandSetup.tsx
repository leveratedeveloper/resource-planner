"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Brand } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

export const BrandSetup = () => {
  const { brands, resources, addBrand, updateBrand } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  const handleOpen = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setName(brand.name);
      setColor(brand.color);
      setSelectedResourceIds(brand.resourceIds);
    } else {
      setEditingBrand(null);
      setName("");
      setColor("#3b82f6");
      setSelectedResourceIds([]);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const newBrand: Brand = {
      id: editingBrand ? editingBrand.id : crypto.randomUUID(),
      name,
      color,
      resourceIds: selectedResourceIds,
    };

    if (editingBrand) {
      updateBrand(newBrand);
    } else {
      addBrand(newBrand);
    }
    setIsDialogOpen(false);
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-tight">Brand Management</h2>
        <Button onClick={() => handleOpen()} className="bg-black text-white hover:bg-gray-800 rounded-md">
          <Icon icon="lucide:plus" className="mr-2 h-4 w-4" /> Add Brand
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brands.map((brand) => (
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
                {brand.resourceIds.length} members assigned
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex flex-wrap gap-2 mt-4">
                {brand.resourceIds.slice(0, 3).map((rid) => {
                  const r = resources.find(res => res.id === rid);
                  if (!r) return null;
                  return (
                    <div key={rid} className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-medium">
                      {r.name}
                    </div>
                  );
                })}
                {brand.resourceIds.length > 3 && (
                  <div className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-medium">
                    +{brand.resourceIds.length - 3}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Create New Brand"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="color" className="text-right text-sm font-medium">
                Color
              </label>
              <div className="col-span-3 flex items-center gap-2">
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

            <div className="space-y-2 mt-4">
              <h4 className="font-medium text-sm">Assign Team Members</h4>
              <div className="border rounded-md p-4 h-[200px] overflow-y-auto space-y-2">
                  {resources.map(resource => (
                      <div
                        key={resource.id}
                        className={cn(
                            "flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors",
                            selectedResourceIds.includes(resource.id)
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-accent border-transparent"
                        )}
                        onClick={() => toggleResource(resource.id)}
                      >
                          <div className="flex flex-col">
                              <span className="text-sm font-medium">{resource.name}</span>
                              <span className="text-xs text-muted-foreground">{resource.role}</span>
                          </div>
                          {selectedResourceIds.includes(resource.id) && (
                              <Icon icon="lucide:check" className="text-primary h-4 w-4" />
                          )}
                      </div>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                  Select the employees who will be working on this brand's projects.
                  Only these employees will appear on the dashboard when this brand is selected.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Save Brand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
