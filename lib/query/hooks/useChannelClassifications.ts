import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface ChannelClassification {
  id: string;
  channelName: string;
  channelNameNew: string | null;
  flag: string;
  displayOrder: number | null;
  pillarsId: number | null;
  createdAt: string;
  updatedAt: string;
}

// API Functions
async function fetchChannelClassifications(): Promise<ChannelClassification[]> {
  const response = await fetch("/api/channel-classifications");
  if (!response.ok) {
    throw new Error("Failed to fetch channel classifications");
  }
  const data = await response.json();
  return data.data;
}

// Hooks
export function useChannelClassifications() {
  return useQuery({
    queryKey: queryKeys.channelClassifications,
    queryFn: fetchChannelClassifications,
  });
}
