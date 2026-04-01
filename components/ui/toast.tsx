"use client";

import React, { useEffect } from "react";
import { Icon } from "@iconify/react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ToastProvider() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: {
    id: string;
    title: string;
    description?: string;
    variant?: 'default' | 'destructive' | 'success';
  };
  onClose: () => void;
}

function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const variantStyles = {
    default: "bg-background border-border",
    destructive: "bg-destructive text-destructive-foreground border-destructive",
    success: "bg-green-600 text-white border-green-600",
  };

  const iconMap = {
    default: "lucide:info",
    destructive: "lucide:alert-circle",
    success: "lucide:check-circle",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg shadow-lg border min-w-[300px] max-w-md animate-in slide-in-from-right-full",
        variantStyles[toast.variant || "default"]
      )}
    >
      <Icon icon={iconMap[toast.variant || "default"]} className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium">{toast.title}</p>
        {toast.description && (
          <p className="text-sm opacity-90 mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <Icon icon="lucide:x" className="h-4 w-4" />
      </button>
    </div>
  );
}
