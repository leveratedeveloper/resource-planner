"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSetup } from "./BrandSetup";
import { ResourceManagement } from "./ResourceManagement";

export const SetupManager = () => {
  return (
    <div className="w-full">
      <Tabs defaultValue="brands" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-full">
          <TabsTrigger
            value="brands"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Brand Management
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Team Management
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brands" className="mt-6">
          <BrandSetup />
        </TabsContent>
        <TabsContent value="resources" className="mt-6">
          <ResourceManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};
