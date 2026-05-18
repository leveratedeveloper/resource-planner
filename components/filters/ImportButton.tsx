"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/toast"; // assuming this exists, or use standard toast mechanism if available
import { useQueryClient } from "@tanstack/react-query";

interface ImportButtonProps {
  onImportComplete?: () => void;
}

export const ImportButton: React.FC<ImportButtonProps> = ({ onImportComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import-assignments", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import file");
      }

      const result = await response.json();
      
      // Force refresh assignments and employees after successful import
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      
      alert(`Import successful! Added ${result.createdCount} assignments. ${result.failedRows ? `Failed to map ${result.failedRows} rows.` : ''}`);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import error:", error);
      alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsImporting(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        className="hidden"
      />
      <Button 
        variant="outline" 
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="gap-2"
        data-testid="import-button"
      >
        {isImporting ? (
          <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
        ) : (
          <Icon icon="lucide:import" className="h-4 w-4" />
        )}
        Import
      </Button>
    </>
  );
};
