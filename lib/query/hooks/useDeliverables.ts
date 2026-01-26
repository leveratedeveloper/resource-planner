import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface Deliverable {
  id: string;
  channelId: string | null;
  deliverableName: string;
  deliverableNameNew: string | null;
  flag: string;
  createdAt: string;
  updatedAt: string;
}

// API Functions
async function fetchDeliverables(channelId?: string): Promise<Deliverable[]> {
  const url = channelId
    ? `/api/deliverables?channelId=${channelId}`
    : "/api/deliverables";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch deliverables");
  }
  const data = await response.json();
  return data.data;
}

// Hooks
export function useDeliverables(channelId?: string) {
  return useQuery({
    queryKey: channelId ? queryKeys.deliverablesByChannel(channelId) : queryKeys.deliverables,
    queryFn: () => fetchDeliverables(channelId),
  });
}
