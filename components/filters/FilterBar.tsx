"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

interface FilterBarProps {
  selectedBrandId: string | null;
  onBrandChange: (brandId: string | null) => void;
  selectedDepartment: string | null;
  onDepartmentChange: (dept: string | null) => void;
  onOpenSetup: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedBrandId,
  onBrandChange,
  selectedDepartment,
  onDepartmentChange,
  onOpenSetup,
}) => {
  const { brands, resources } = useApp();
  const departments = Array.from(new Set(resources.map((r) => r.department))).filter(Boolean);

  return (
    <div className="flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
           <Icon icon="lucide:filter" className="text-muted-foreground" />
           <span className="font-medium">Filters:</span>
        </div>
        
        <Select
          value={selectedBrandId || "all"}
          onValueChange={(val) => onBrandChange(val === "all" ? null : val)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  {brand.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedDepartment || "all"}
          onValueChange={(val) => onDepartmentChange(val === "all" ? null : val)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
             <SelectItem value="all">All Departments</SelectItem>
             {departments.map((dept) => (
               <SelectItem key={dept} value={dept}>
                 {dept}
               </SelectItem>
             ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onOpenSetup} variant="outline">
        <Icon icon="lucide:settings" className="mr-2 h-4 w-4" />
        Setup / Manage Brands
      </Button>
    </div>
  );
};
