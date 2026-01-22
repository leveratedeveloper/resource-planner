"use client";

import React, { useState } from "react";
import { useEmployees, useCreateEmployee, useUpdateEmployee, type Employee } from "@/lib/query/hooks/useEmployees";
import { useDepartments } from "@/lib/query/hooks/useDepartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";

export const ResourceManagement = () => {
    const { data: employees = [], isLoading } = useEmployees();
    const { data: departments = [] } = useDepartments();
    const createEmployee = useCreateEmployee();
    const updateEmployee = useUpdateEmployee();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Form State
    const [fullName, setFullName] = useState("");
    const [position, setPosition] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [weeklyCapacity, setWeeklyCapacity] = useState(40);
    const [email, setEmail] = useState("");

    const handleOpen = (employee?: Employee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFullName(employee.fullName);
            setPosition(employee.position);
            setDepartmentId(employee.departmentId || "");
            setWeeklyCapacity(employee.weeklyCapacity);
            setEmail(employee.email || "");
        } else {
            setEditingEmployee(null);
            setFullName("");
            setPosition("");
            setDepartmentId("");
            setWeeklyCapacity(40);
            setEmail("");
        }
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (editingEmployee) {
            // Update existing employee
            updateEmployee.mutate({
                id: editingEmployee.id,
                fullName,
                position,
                departmentId: departmentId || null,
                weeklyCapacity,
                email: email || null,
            }, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                }
            });
        } else {
            // Create new employee
            createEmployee.mutate({
                fullName,
                position,
                departmentId: departmentId || null,
                weeklyCapacity,
                email: email || null,
                employmentStatus: 'active',
                visibility: 'active',
            }, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                }
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
                <Button onClick={() => handleOpen()}>
                    <Icon icon="lucide:plus" className="mr-2 h-4 w-4" /> Add Member
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading employees...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((employee) => {
                        const dept = departments.find(d => d.id === employee.departmentId);
                        return (
                            <Card key={employee.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{employee.fullName}</CardTitle>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpen(employee)}>
                                            <Icon icon="lucide:edit-2" className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                    <CardDescription>{employee.position} • {dept?.name || 'No Department'}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                   <div className="text-sm text-muted-foreground">
                                       Capacity: <span className="font-medium text-foreground">{employee.weeklyCapacity}h/week</span>
                                   </div>
                                   {employee.email && (
                                       <div className="text-sm text-muted-foreground mt-1">
                                           {employee.email}
                                       </div>
                                   )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Full Name</label>
                            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="col-span-3" placeholder="e.g. John Doe" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Email</label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" placeholder="john.doe@company.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Position</label>
                            <Input value={position} onChange={(e) => setPosition(e.target.value)} className="col-span-3" placeholder="e.g. Senior Designer" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Department</label>
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: dept.color }}
                                                />
                                                {dept.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Capacity (h/week)</label>
                            <Input type="number" value={weeklyCapacity} onChange={(e) => setWeeklyCapacity(Number(e.target.value))} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={createEmployee.isPending || updateEmployee.isPending}>
                            {createEmployee.isPending || updateEmployee.isPending ? "Saving..." : "Save Employee"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
