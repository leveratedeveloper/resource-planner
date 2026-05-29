export interface EditableProjectChannel {
  channelId: string;
  deliverableId: string;
  quantity: string;
  channelBudget: string;
  manHours: string;
}

export function updateProjectChannelManHours<T extends EditableProjectChannel>(
  channels: T[],
  channelIndex: number,
  manHours: string
): T[] {
  const sanitizedManHours = sanitizeManHoursInput(manHours);

  return channels.map((channel, index) =>
    index === channelIndex ? { ...channel, manHours: sanitizedManHours } : channel
  );
}

export function hasProjectChannelManHoursChanges(
  currentChannels: EditableProjectChannel[],
  initialChannels: EditableProjectChannel[]
): boolean {
  if (currentChannels.length !== initialChannels.length) return true;

  return currentChannels.some((channel, index) => {
    return channel.manHours !== initialChannels[index]?.manHours;
  });
}

export function sanitizeManHoursInput(value: string): string {
  let hasDecimal = false;

  return Array.from(value)
    .filter((char) => {
      if (char >= "0" && char <= "9") return true;
      if (char === "." && !hasDecimal) {
        hasDecimal = true;
        return true;
      }
      return false;
    })
    .join("");
}
