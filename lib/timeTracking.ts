export interface TimeEntryRecord {
  id: string;
  client_id?: string | null;
  invoice_id?: string | null;
  duration_minutes: number;
  billable?: boolean | null;
  entry_date: string;
  clients?: { name?: string | null } | null;
}

export function formatMinutesAsHoursMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function parseDurationInputToMinutes(input: string): number {
  const normalized = (input || '').trim().toLowerCase();
  if (!normalized) return 0;

  const hmMatch = normalized.match(/^(\d+)\s*h(?:\s*(\d+)\s*m?)?$/);
  if (hmMatch) {
    const hours = Number(hmMatch[1] || 0);
    const minutes = Number(hmMatch[2] || 0);
    return hours * 60 + minutes;
  }

  const minutesOnlyMatch = normalized.match(/^(\d+)\s*m$/);
  if (minutesOnlyMatch) {
    return Number(minutesOnlyMatch[1] || 0);
  }

  const decimalHoursMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (decimalHoursMatch) {
    return Math.round(Number(decimalHoursMatch[1]) * 60);
  }

  const rawNumber = Number(normalized);
  if (Number.isFinite(rawNumber) && rawNumber > 0) {
    return Math.round(rawNumber);
  }

  return 0;
}

export function buildTimeReport(entries: TimeEntryRecord[]) {
  const totalMinutes = entries.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  const billableMinutes = entries
    .filter((entry) => entry.billable !== false)
    .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  const nonBillableMinutes = Math.max(0, totalMinutes - billableMinutes);

  const minutesByClient = new Map<string, number>();
  entries.forEach((entry) => {
    const clientName = entry.clients?.name || `Client ${entry.client_id?.slice(0, 6) || 'Unknown'}`;
    minutesByClient.set(clientName, (minutesByClient.get(clientName) || 0) + Number(entry.duration_minutes || 0));
  });

  const byClient = Array.from(minutesByClient.entries())
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const byDayMap = new Map<string, number>();
  entries.forEach((entry) => {
    const date = (entry.entry_date || '').slice(0, 10);
    if (!date) return;
    byDayMap.set(date, (byDayMap.get(date) || 0) + Number(entry.duration_minutes || 0));
  });

  const byDay = Array.from(byDayMap.entries())
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalMinutes,
    billableMinutes,
    nonBillableMinutes,
    linkedInvoiceCount: new Set(entries.filter((entry) => entry.invoice_id).map((entry) => entry.invoice_id)).size,
    byClient,
    byDay,
  };
}
