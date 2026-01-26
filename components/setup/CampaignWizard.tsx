"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCreateProject, type Project } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PROJECT_COLORS = [
  "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const ENTITIES = ["LSI", "SSI", "LMA"];

interface ProjectChannel {
  channelId: string;
  deliverableId: string;
  quantity: string;
  manHours: string;
}

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ isOpen, onClose }) => {
  const createProject = useCreateProject();
  const { data: brands = [] } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: channels = [] } = useChannelClassifications();
  const { data: allDeliverables = [] } = useDeliverables();

  // Wizard step tracking
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  // Step 1 state
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [entity, setEntity] = useState("LSI");

  // Step 2 state
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [projectChannels, setProjectChannels] = useState<ProjectChannel[]>([]);

  // Calculate total man hours
  const totalManHours = useMemo(() => {
    return projectChannels.reduce((sum, ch) =>
      sum + (parseFloat(ch.manHours || "0")), 0
    );
  }, [projectChannels]);

  // Filter brands by selected business unit
  const filteredBrands = useMemo(() => {
    if (!businessUnitId) return brands;
    return brands.filter(b => !b.businessUnitId || b.businessUnitId === businessUnitId);
  }, [brands, businessUnitId]);

  // Get business unit for breadcrumb
  const selectedBusinessUnit = useMemo(() => {
    return businessUnits.find(bu => bu.id === businessUnitId);
  }, [businessUnits, businessUnitId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setWizardStep(1);
      setBusinessUnitId("");
      setEntity("LSI");
      setBrandId("");
      setName("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setColor(PROJECT_COLORS[0]);
      setProjectChannels([]);
    }
  }, [isOpen]);

  // Channel management functions
  const addChannel = () => {
    setProjectChannels([...projectChannels, {
      channelId: "",
      deliverableId: "",
      quantity: "",
      manHours: "",
    }]);
  };

  const removeChannel = (index: number) => {
    setProjectChannels(projectChannels.filter((_, i) => i !== index));
  };

  const updateChannel = (index: number, field: string, value: string) => {
    const updated = [...projectChannels];
    updated[index] = { ...updated[index], [field]: value };
    // Reset deliverable when channel changes
    if (field === 'channelId') {
      updated[index].deliverableId = "";
    }
    setProjectChannels(updated);
  };

  const getDeliverablesForChannel = (channelId: string) => {
    return allDeliverables.filter(d => d.channelId === channelId);
  };

  // Navigation handlers
  const handleNext = () => {
    // Validate Step 1
    if (!businessUnitId || !entity) {
      alert("Please select business unit and entity");
      return;
    }
    setWizardStep(2);
  };

  const handleBack = () => {
    setWizardStep(1);
  };

  const handlePublish = async () => {
    // Validate Step 2
    if (!name.trim() || !brandId) {
      alert("Please fill in all required fields");
      return;
    }

    const projectData = {
      projectType: 'campaign' as const,
      businessUnitId,
      entity,
      brandId,
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes || null,
      color,
      status: 'active' as const,
      projectChannels: projectChannels
        .filter(pc => pc.channelId && pc.deliverableId)
        .map(pc => ({
          channelId: pc.channelId,
          deliverableId: pc.deliverableId,
          quantity: pc.quantity || null,
          manHours: pc.manHours || null,
        })),
    };

    createProject.mutate(projectData as any, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        console.error("Failed to create campaign:", error);
        alert("Failed to create campaign. Please try again.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {wizardStep === 1 ? (
          // Step 1: Campaign Configuration
          <>
            <DialogHeader>
              <DialogTitle>Campaign Configuration</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Select business unit and entity to start creating a campaign
              </p>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Business Unit Selection with Logos */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Select Business Unit <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-4">
                  {businessUnits.map((bu) => (
                    <button
                      key={bu.id}
                      type="button"
                      onClick={() => setBusinessUnitId(bu.id)}
                      className={cn(
                        "border rounded-lg p-4 h-24 flex items-center justify-center transition-all",
                        "hover:border-primary hover:bg-accent",
                        businessUnitId === bu.id && "border-primary bg-accent ring-2 ring-primary"
                      )}
                    >
                      {bu.logo ? (
                        <img
                          src={bu.logo}
                          alt={bu.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-sm font-medium">{bu.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Select Entity <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {ENTITIES.map((ent) => (
                    <Button
                      key={ent}
                      type="button"
                      variant={entity === ent ? "default" : "outline"}
                      onClick={() => setEntity(ent)}
                      className="h-16 text-lg"
                    >
                      {ent}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={onClose}>Back</Button>
              <Button onClick={handleNext} disabled={!businessUnitId || !entity}>
                Submit
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Step 2: Campaign Details
          <>
            <DialogHeader>
              <DialogTitle>Add Campaign</DialogTitle>
              <div className="text-sm text-muted-foreground">
                Home / Campaigns / New Campaign on {selectedBusinessUnit?.name || entity}
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Brand and Campaign Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Brand Name <span className="text-red-500">*</span>
                  </label>
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBrands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Input campaign name"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color === c && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      type="button"
                    />
                  ))}
                </div>
              </div>

              {/* Channels Section - Focus on Man Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Channels & Deliverables</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addChannel}>
                    <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
                    Add Channel
                  </Button>
                </div>

                <div className="text-sm font-medium text-muted-foreground">
                  Total Man Hours: {totalManHours.toFixed(1)} hours
                </div>

                {/* Channel Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Channel Name*</th>
                        <th className="text-left p-3 text-sm font-medium">Deliverables*</th>
                        <th className="text-left p-3 text-sm font-medium">Qty</th>
                        <th className="text-left p-3 text-sm font-medium">Man Hr*</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectChannels.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No channels added yet. Click "Add Channel" to start planning resources.
                          </td>
                        </tr>
                      ) : (
                        projectChannels.map((channel, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Select
                                value={channel.channelId}
                                onValueChange={(value) => updateChannel(index, 'channelId', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choose channel" />
                                </SelectTrigger>
                                <SelectContent>
                                  {channels.map((ch) => (
                                    <SelectItem key={ch.id} value={ch.id}>
                                      {ch.channelName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select
                                value={channel.deliverableId}
                                onValueChange={(value) => updateChannel(index, 'deliverableId', value)}
                                disabled={!channel.channelId}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select deliverable" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getDeliverablesForChannel(channel.channelId).map((del) => (
                                    <SelectItem key={del.id} value={del.id}>
                                      {del.deliverableName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                value={channel.quantity}
                                onChange={(e) => updateChannel(index, 'quantity', e.target.value)}
                                placeholder="Quantity"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.5"
                                value={channel.manHours}
                                onChange={(e) => updateChannel(index, 'manHours', e.target.value)}
                                placeholder="Hours"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeChannel(index)}
                              >
                                <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Input additional note"
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <Icon icon="lucide:arrow-left" className="h-4 w-4 mr-2" />
                BACK
              </Button>
              <Button
                onClick={handlePublish}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!name.trim() || !brandId || createProject.isPending}
              >
                {createProject.isPending ? "Publishing..." : "PUBLISH"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
