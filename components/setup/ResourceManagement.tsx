"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useInfiniteEmployees, type Employee } from "@/lib/query/hooks/useEmployees";
import { useDepartments } from "@/lib/query/hooks/useDepartments";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { cn } from "@/lib/utils";

// Helper to format date for display
const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

export const ResourceManagement = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);
    
    const {
        data: employeesData,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteEmployees(debouncedSearch || undefined);
    const { data: departments = [] } = useDepartments();

    // Flatten all pages into a single array of employees
    const employees = useMemo(() => {
        if (!employeesData?.pages) return [];
        return employeesData.pages.flatMap((page) => page.data);
    }, [employeesData]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    const handleViewEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsDialogOpen(true);
    };

    const { sentinelRef, isStuck } = useIsStuck(40);

    // Get department info for selected employee
    const selectedDepartment = selectedEmployee 
        ? departments.find(d => d.id === selectedEmployee.departmentId) 
        : null;

    return (
        <div className="space-y-6">
            <div ref={sentinelRef} className="h-px -mt-px invisible" />
            <div className={cn("sticky top-10 z-10 bg-background py-3 px-2 flex justify-between items-center transition-shadow duration-200", isStuck && "shadow-sm")}>
                <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            data-testid="resource-search-input"
                            placeholder="Search employees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="border rounded-xl bg-white shadow-sm p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <Skeleton className="h-6 w-1/2" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {employees.map((employee) => {
                            const dept = departments.find(d => d.id === employee.departmentId);
                            return (
                                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg">{employee.fullName}</CardTitle>
                                            <Button variant="ghost" size="icon" onClick={() => handleViewEmployee(employee)}>
                                                <Icon icon="lucide:eye" className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                        <CardDescription>{employee.position} • {dept?.name || 'No Department'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                       <div className="text-sm text-muted-foreground">
                                           Capacity: <span className="font-medium text-foreground">{employee.weeklyCapacity}h/week</span>
                                       </div>
                                       {employee.employeeNumber && (
                                           <div className="text-sm text-muted-foreground mt-1">
                                               ID: <span className="font-medium text-foreground">{employee.employeeNumber}</span>
                                           </div>
                                       )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                    <InfiniteScrollTrigger
                        onLoadMore={handleLoadMore}
                        hasMore={!!hasNextPage}
                        isLoading={isFetchingNextPage}
                        skeletonCount={3}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="border rounded-xl bg-white shadow-sm p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <Skeleton className="h-6 w-1/2" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </InfiniteScrollTrigger>
                </>
            )}

            {/* View Employee Modal - Read Only */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <Icon icon="lucide:user" className="h-5 w-5" />
                            Employee Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedEmployee && (
                        <div className="grid gap-4 py-4">
                            {/* Basic Info Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Employee ID</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.employeeNumber || '-'}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Full Name</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.fullName}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Nickname</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.nickname || '-'}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Email</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.email || '-'}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Gender</span>
                                    <div className="col-span-2 flex items-center gap-2">
                                        {selectedEmployee.gender ? (
                                            <>
                                                <Icon 
                                                    icon={selectedEmployee.gender === 'MALE' ? 'lucide:user' : 'lucide:user'} 
                                                    className={`h-4 w-4 ${selectedEmployee.gender === 'MALE' ? 'text-blue-500' : 'text-pink-500'}`} 
                                                />
                                                <span className="text-sm font-medium">
                                                    {selectedEmployee.gender === 'MALE' ? 'Male' : 'Female'}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-medium">-</span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Date of Birth</span>
                                    <span className="col-span-2 text-sm font-medium">{formatDate(selectedEmployee.dateOfBirth)}</span>
                                </div>
                            </div>

                            <hr className="my-2" />

                            {/* Work Info Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Work Information</h4>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Position</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.position}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Department</span>
                                    <div className="col-span-2 flex items-center gap-2">
                                        {selectedDepartment ? (
                                            <>
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: selectedDepartment.color }}
                                                />
                                                <span className="text-sm font-medium">{selectedDepartment.name}</span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-medium text-muted-foreground">-</span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Date Joined</span>
                                    <span className="col-span-2 text-sm font-medium">{formatDate(selectedEmployee.workStartDate)}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Capacity</span>
                                    <span className="col-span-2 text-sm font-medium">{selectedEmployee.weeklyCapacity} hours/week</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <div className="col-span-2">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                            selectedEmployee.employmentStatus === 'active' 
                                                ? "bg-green-100 text-green-800" 
                                                : selectedEmployee.employmentStatus === 'contractor'
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-gray-100 text-gray-800"
                                        )}>
                                            {selectedEmployee.employmentStatus.charAt(0).toUpperCase() + selectedEmployee.employmentStatus.slice(1)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <span className="text-sm text-muted-foreground">Visibility</span>
                                    <div className="col-span-2">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                            selectedEmployee.visibility === 'active' 
                                                ? "bg-green-100 text-green-800" 
                                                : "bg-gray-100 text-gray-800"
                                        )}>
                                            {selectedEmployee.visibility.charAt(0).toUpperCase() + selectedEmployee.visibility.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
