import { describe, expect, it } from "vitest";
import {
  hasProjectChannelManHoursChanges,
  sanitizeManHoursInput,
  updateProjectChannelManHours,
} from "@/lib/setup/project-channel-editor";

describe("updateProjectChannelManHours", () => {
  it("updates only the selected channel man hours", () => {
    const channels = [
      { channelId: "social", deliverableId: "post", quantity: "5", channelBudget: "1000", manHours: "40" },
      { channelId: "web", deliverableId: "page", quantity: "1", channelBudget: "2000", manHours: "80" },
    ];

    expect(updateProjectChannelManHours(channels, 1, "96")).toEqual([
      { channelId: "social", deliverableId: "post", quantity: "5", channelBudget: "1000", manHours: "40" },
      { channelId: "web", deliverableId: "page", quantity: "1", channelBudget: "2000", manHours: "96" },
    ]);
  });
});

describe("sanitizeManHoursInput", () => {
  it("keeps only digits and one decimal point", () => {
    expect(sanitizeManHoursInput("12abc.5e7.9")).toBe("12.579");
  });
});

describe("hasProjectChannelManHoursChanges", () => {
  const initialChannels = [
    { channelId: "social", deliverableId: "post", quantity: "5", channelBudget: "1000", manHours: "40" },
    { channelId: "web", deliverableId: "page", quantity: "1", channelBudget: "2000", manHours: "80" },
  ];

  it("detects changed man hours against the initial channel snapshot", () => {
    const currentChannels = updateProjectChannelManHours(initialChannels, 1, "96");

    expect(hasProjectChannelManHoursChanges(currentChannels, initialChannels)).toBe(true);
  });

  it("clears dirty state when the initial snapshot matches current man hours", () => {
    const savedChannels = updateProjectChannelManHours(initialChannels, 1, "96");

    expect(hasProjectChannelManHoursChanges(savedChannels, savedChannels)).toBe(false);
  });
});
