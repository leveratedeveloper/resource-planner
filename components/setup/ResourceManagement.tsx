"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Resource } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";

export const ResourceManagement = () => {
    const { resources, addResource, updateResource } = useApp();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | null>(null);

    // Form State
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [department, setDepartment] = useState("");
    const [capacity, setCapacity] = useState(40);

    const handleOpen = (resource?: Resource) => {
        if (resource) {
            setEditingResource(resource);
            setName(resource.name);
            setRole(resource.role);
            setDepartment(resource.department);
            setCapacity(resource.capacity);
        } else {
            setEditingResource(null);
            setName("");
            setRole("");
            setDepartment("");
            setCapacity(40);
        }
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        const newResource: Resource = {
            id: editingResource ? editingResource.id : crypto.randomUUID(),
            name,
            role,
            department,
            capacity,
        };

        if (editingResource) {
            updateResource(newResource);
        } else {
            addResource(newResource);
        }
        setIsDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
                <Button onClick={() => handleOpen()}>
                    <Icon icon="lucide:plus" className="mr-2 h-4 w-4" /> Add Member
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource) => (
                    <Card key={resource.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{resource.name}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => handleOpen(resource)}>
                                    <Icon icon="lucide:edit-2" className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                            <CardDescription>{resource.role} • {resource.department}</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <div className="text-sm text-muted-foreground">
                               Capacity: <span className="font-medium text-foreground">{resource.capacity}h/week</span>
                           </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingResource ? "Edit Member" : "Add New Member"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Role</label>
                            <Input value={role} onChange={(e) => setRole(e.target.value)} className="col-span-3" placeholder="e.g. Designer" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Department</label>
                            <Input value={department} onChange={(e) => setDepartment(e.target.value)} className="col-span-3" placeholder="e.g. Creative" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">Capacity (h)</label>
                            <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave}>Save Member</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
