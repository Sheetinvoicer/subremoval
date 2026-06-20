import { buildTimeReport, formatMinutesAsHoursMinutes, parseDurationInputToMinutes } from '@/lib/timeTracking';

describe('timeTracking utilities', () => {
  it('formats minutes into a readable hours/minutes label', () => {
    expect(formatMinutesAsHoursMinutes(45)).toBe('45m');
    expect(formatMinutesAsHoursMinutes(60)).toBe('1h');
    expect(formatMinutesAsHoursMinutes(125)).toBe('2h 5m');
  });

  it('parses manual duration inputs', () => {
    expect(parseDurationInputToMinutes('90')).toBe(90);
    expect(parseDurationInputToMinutes('1h 30m')).toBe(90);
    expect(parseDurationInputToMinutes('2h')).toBe(120);
    expect(parseDurationInputToMinutes('bad input')).toBe(0);
  });

  it('builds time report totals and aggregations', () => {
    const report = buildTimeReport([
      {
        id: '1',
        client_id: 'c1',
        invoice_id: 'i1',
        duration_minutes: 60,
        billable: true,
        entry_date: '2026-06-01',
        clients: { name: 'Acme' },
      },
      {
        id: '2',
        client_id: 'c1',
        invoice_id: null,
        duration_minutes: 30,
        billable: false,
        entry_date: '2026-06-01',
        clients: { name: 'Acme' },
      },
    ]);

    expect(report.totalMinutes).toBe(90);
    expect(report.billableMinutes).toBe(60);
    expect(report.nonBillableMinutes).toBe(30);
    expect(report.linkedInvoiceCount).toBe(1);
    expect(report.byClient[0]).toEqual({ name: 'Acme', minutes: 90 });
    expect(report.byDay[0]).toEqual({ date: '2026-06-01', minutes: 90 });
  });
});
