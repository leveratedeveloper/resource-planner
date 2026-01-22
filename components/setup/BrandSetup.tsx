"use client";

import React, { useState } from "react";
import { useBrands, useCreateBrand, useUpdateBrand, type Brand } from "@/lib/query/hooks/useBrands";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

export const BrandSetup = () => {
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const handleOpen = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setName(brand.name);
      setColor(brand.color);
      // Get currently assigned employees from employeeBrandAssignments
      const assignedEmployeeIds = brand.employeeBrandAssignments?.map(a => a.employeeId) || [];
      setSelectedEmployeeIds(assignedEmployeeIds);
    } else {
      setEditingBrand(null);
      setName("");
      setColor("#3b82f6");
      setSelectedEmployeeIds([]);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingBrand) {
      // Update existing brand
      updateBrand.mutate({
        id: editingBrand.id,
        name,
        color,
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          // TODO: Update employee-brand assignments separately
          // For now, employee assignments are managed via the separate employee-brand assignment API
        }
      });
    } else {
      // Create new brand
      createBrand.mutate({
        name,
        color,
        status: 'active',
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          // TODO: Create employee-brand assignments for selected employees
        }
      });
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
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

      {brandsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading brands...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brands.map((brand) => {
            const assignedEmployees = brand.employeeBrandAssignments?.map(assignment =>
              employees.find(emp => emp.id === assignment.employeeId)
            ).filter(Boolean) || [];

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
                    {assignedEmployees.length} members assigned
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="flex flex-wrap gap-2 mt-4">
                    {assignedEmployees.slice(0, 3).map((emp: any) => (
                      <div key={emp.id} className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-medium">
                        {emp.fullName}
                      </div>
                    ))}
                    {assignedEmployees.length > 3 && (
                      <div className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-medium">
                        +{assignedEmployees.length - 3}
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
              <p className="text-xs text-muted-foreground">
                  Note: Employee assignments are currently managed separately.
                  This feature will be enhanced in a future update.
              </p>
              <div className="border rounded-md p-4 h-[200px] overflow-y-auto space-y-2">
                  {employees.map(employee => (
                      <div
                        key={employee.id}
                        className={cn(
                            "flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors",
                            selectedEmployeeIds.includes(employee.id)
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-accent border-transparent"
                        )}
                        onClick={() => toggleEmployee(employee.id)}
                      >
                          <div className="flex flex-col">
                              <span className="text-sm font-medium">{employee.fullName}</span>
                              <span className="text-xs text-muted-foreground">{employee.position}</span>
                          </div>
                          {selectedEmployeeIds.includes(employee.id) && (
                              <Icon icon="lucide:check" className="text-primary h-4 w-4" />
                          )}
                      </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={createBrand.isPending || updateBrand.isPending}>
              {createBrand.isPending || updateBrand.isPending ? "Saving..." : "Save Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
