import { calcDiscount, DEFAULT_LABOR_RATE_LKR, type DiscountType } from './totals.ts';

/** Pure maths for the admin Tech Hours page. No Supabase, no React. */

export interface TechHoursLabourLine {
    hours: number | string | null;
    quantity?: number | string | null;
    hourly_rate_lkr: number | string | null;
    is_fixed?: boolean | null;
    is_outsourced?: boolean | null;
    discount_type?: DiscountType | null;
    discount_value?: number | string | null;
}

export interface TechHoursJob {
    id: string;
    description?: string | null;
    completed_at: string;
    assigned_staff_id?: string | null;
    assigned_technician_id?: string | null;
    is_outsourced?: boolean | null;
    vehicles?: { license_plate?: string | null; make?: string | null; model?: string | null } | null;
    job_labor?: TechHoursLabourLine[] | null;
}

export interface TechHoursStaff {
    id: string;
    name: string;
    profile_id?: string | null;
    active?: boolean | null;
}

export interface TechHoursJobRow {
    id: string;
    plate: string;
    vehicle: string;
    description: string;
    completedAt: string;
    hours: number;
    fixedLines: number;
    value: number;
}

export interface TechHoursRow {
    key: string;
    name: string;
    unassigned: boolean;
    jobs: TechHoursJobRow[];
    jobCount: number;
    hours: number;
    fixedLines: number;
    value: number;
}

export interface TechHoursReport {
    rows: TechHoursRow[];
    totals: { jobCount: number; hours: number; fixedLines: number; value: number };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** First instant of the month and of the next one, in the device's local time. */
export function monthBounds(year: number, month: number) {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

/** Last `count` months, newest first, as {year, month} (month 0-based). */
export function recentMonths(now: Date, count: number) {
    const out: { year: number; month: number }[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return out;
}

/**
 * Billed hours: hourly lines only. A fixed-price line is stored as hours = 1 and
 * rate = the amount (update_fixed_labour.sql), so its "1 hour" is not time and is
 * counted separately. Sublet (outsourced) lines are not the technician's work.
 */
export function jobLabour(lines: TechHoursLabourLine[] | null | undefined) {
    let hours = 0;
    let fixedLines = 0;
    let value = 0;
    for (const l of lines || []) {
        if (l.is_outsourced) continue;
        const qty = Math.max(1, Number(l.quantity) || 1);
        const h = Number(l.hours) || 0;
        const gross = qty * h * (Number(l.hourly_rate_lkr) || DEFAULT_LABOR_RATE_LKR);
        value += gross - calcDiscount(gross, l.discount_type, l.discount_value);
        if (l.is_fixed) fixedLines += 1;
        else hours += qty * h;
    }
    return { hours: round1(hours), fixedLines, value: Math.round(value) };
}

export function buildTechHoursReport(staff: TechHoursStaff[], jobs: TechHoursJob[]): TechHoursReport {
    const byStaffId = new Map(staff.map(s => [s.id, s]));
    const byProfileId = new Map(staff.filter(s => s.profile_id).map(s => [s.profile_id as string, s]));
    const rows = new Map<string, TechHoursRow>();

    for (const job of jobs) {
        if (job.is_outsourced) continue;
        const tech = (job.assigned_staff_id && byStaffId.get(job.assigned_staff_id))
            || (job.assigned_technician_id && byProfileId.get(job.assigned_technician_id))
            || null;
        const key = tech ? tech.id : 'unassigned';
        let row = rows.get(key);
        if (!row) {
            row = { key, name: tech ? tech.name : 'No tech', unassigned: !tech, jobs: [], jobCount: 0, hours: 0, fixedLines: 0, value: 0 };
            rows.set(key, row);
        }
        const l = jobLabour(job.job_labor);
        const v = job.vehicles;
        row.jobs.push({
            id: job.id,
            plate: v?.license_plate || '—',
            vehicle: [v?.make, v?.model].filter(Boolean).join(' '),
            description: job.description || '',
            completedAt: job.completed_at,
            hours: l.hours,
            fixedLines: l.fixedLines,
            value: l.value,
        });
        row.jobCount += 1;
        row.hours += l.hours;
        row.fixedLines += l.fixedLines;
        row.value += l.value;
    }

    const list = [...rows.values()].map(r => ({
        ...r,
        hours: round1(r.hours),
        jobs: r.jobs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
    }));
    list.sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || b.hours - a.hours || b.value - a.value);

    const totals = list.reduce(
        (t, r) => ({ jobCount: t.jobCount + r.jobCount, hours: t.hours + r.hours, fixedLines: t.fixedLines + r.fixedLines, value: t.value + r.value }),
        { jobCount: 0, hours: 0, fixedLines: 0, value: 0 },
    );
    totals.hours = round1(totals.hours);
    return { rows: list, totals };
}
