"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSetup } from "./BrandSetup";
import { ResourceManagement } from "./ResourceManagement";
import { ProjectSetup } from "./ProjectSetup";

export const SetupManager = () => {
  const [activeTab, setActiveTab] = useState<"brands" | "projects" | "resources">("brands");

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex h-full w-full flex-col gap-0">
      <div className="sticky top-0 z-30 border-b bg-background py-5 pl-6 pr-16">
        <TabsList className="grid h-10 w-full grid-cols-3 rounded-full bg-muted p-1">
          <TabsTrigger
            value="brands"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            data-testid="setup-tab-brands"
          >
            Brands
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            data-testid="setup-tab-projects"
          >
            Projects
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            data-testid="setup-tab-resources"
          >
            Team
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="brands" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === "brands" ? <BrandSetup /> : null}
      </TabsContent>
      <TabsContent value="projects" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === "projects" ? <ProjectSetup /> : null}
      </TabsContent>
      <TabsContent value="resources" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === "resources" ? <ResourceManagement /> : null}
      </TabsContent>
    </Tabs>
  );
};
