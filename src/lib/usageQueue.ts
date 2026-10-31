// Pure batching for usage events: no Supabase, no React, no DOM, so it runs under node tests.

export type UsageEventType = 'page_view' | 'click';

export interface UsageRow {
    tenant_id: string;
    user_id: string;
    event: UsageEventType;
    name: string;
    meta: Record<string, string | number | boolean | null>;
    created_at: string;
}

// 'missing' = the table isn't there yet (or this user may not write to it): stop for the session.
export type SendResult = 'ok' | 'missing' | 'error';

export interface UsageQueueOptions {
    send: (rows: UsageRow[]) => Promise<SendResult>;
    maxBatch?: number;
    maxQueue?: number;
    maxFailures?: number;
}

export interface UsageQueue {
    push: (row: UsageRow) => void;
    flush: () => Promise<void>;
    size: () => number;
    disabled: () => boolean;
    drain: () => UsageRow[];
}

export const MAX_NAME_LENGTH = 80;

export function createUsageQueue({ send, maxBatch = 50, maxQueue = 300, maxFailures = 3 }: UsageQueueOptions): UsageQueue {
    let queue: UsageRow[] = [];
    let inFlight = false;
    let failures = 0;
    let off = false;

    const push = (row: UsageRow) => {
        if (off) return;
        queue.push(row);
        // Oldest events are the cheapest to lose if the device is offline for a long time.
        if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
    };

    const flush = async () => {
        if (off || inFlight || queue.length === 0) return;
        inFlight = true;
        const batch = queue.slice(0, maxBatch);
        queue = queue.slice(batch.length);
        let result: SendResult;
        try {
            result = await send(batch);
        } catch {
            result = 'error';
        }
        inFlight = false;
        if (result === 'ok') {
            failures = 0;
            return;
        }
        if (result === 'missing') {
            off = true;
            queue = [];
            return;
        }
        failures += 1;
        if (failures >= maxFailures) {
            off = true;
            queue = [];
            return;
        }
        queue = [...batch, ...queue].slice(-maxQueue);
    };

    return {
        push,
        flush,
        size: () => queue.length,
        disabled: () => off,
        drain: () => {
            const rows = queue;
            queue = [];
            return rows;
        },
    };
}

const ID_LIKE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[A-Za-z0-9_-]{16,})$/i;

// "/jobs/5416b1a7-…" -> "/jobs/:id": screens are counted, records and tokens are not stored.
export function normalizeRoute(pathname: string): string {
    const clean = (pathname || '/').split(/[?#]/)[0];
    const parts = clean.split('/').filter(Boolean).map(p => (ID_LIKE.test(p) ? ':id' : p.toLowerCase()));
    const route = '/' + parts.join('/');
    return route.slice(0, MAX_NAME_LENGTH);
}

export function cleanName(name: string): string {
    return String(name || '').trim().slice(0, MAX_NAME_LENGTH);
}
