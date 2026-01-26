"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSetup } from "./BrandSetup";
import { ResourceManagement } from "./ResourceManagement";
import { ProjectSetup } from "./ProjectSetup";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { cn } from "@/lib/utils";

export const SetupManager = () => {
  const { sentinelRef, isStuck } = useIsStuck(0);

  return (
    <div className="w-full">
      <Tabs defaultValue="brands" className="w-full">
        <div ref={sentinelRef} className="h-px -mt-px invisible" />
        <TabsList className={cn("sticky top-0 z-10 bg-muted p-1 rounded-full grid w-full grid-cols-3 transition-shadow duration-200", isStuck && "shadow-sm")}>
          <TabsTrigger
            value="brands"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Brands
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Projects
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Team
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brands" className="mt-6">
          <BrandSetup />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <ProjectSetup />
        </TabsContent>
        <TabsContent value="resources" className="mt-6">
          <ResourceManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};
