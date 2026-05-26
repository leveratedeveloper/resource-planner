import { describe, expect, it } from "vitest";
import { sanitizeManHoursInput, updateProjectChannelManHours } from "@/lib/setup/project-channel-editor";

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
