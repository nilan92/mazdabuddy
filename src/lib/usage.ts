import { supabase } from './supabase';
import { createUsageQueue, normalizeRoute, cleanName, type UsageRow, type SendResult } from './usageQueue';

// Lightweight in-house usage log (usage_events). Batched, fire-and-forget: a failure
// here must never reach the UI, and if the table doesn't exist yet it simply goes quiet.

const FLUSH_MS = 10_000;
const STORE_KEY = 'autopulse_usage_pending';
const MISSING_CODES = new Set(['PGRST205', 'PGRST204', '42P01', '42501', 'PGRST301']);

type Meta = Record<string, string | number | boolean | null>;

let identity: { tenantId: string; userId: string } | null = null;
let lastRoute: string | null = null;
let lastIdentityKey: string | null = null;
let currentRoute = '/';
let timer: ReturnType<typeof setInterval> | null = null;
let listenersOn = false;

async function send(rows: UsageRow[]): Promise<SendResult> {
    const { error, status } = await supabase.from('usage_events').insert(rows);
    if (!error) return 'ok';
    if (status === 404 || (error.code && MISSING_CODES.has(error.code))) return 'missing';
    return 'error';
}

const queue = createUsageQueue({ send });

function persistPending() {
    try {
        const rows = queue.drain();
        if (rows.length) localStorage.setItem(STORE_KEY, JSON.stringify(rows.slice(-100)));
    } catch { /* storage full or blocked */ }
}

function restorePending() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        localStorage.removeItem(STORE_KEY);
        if (!raw || !identity) return;
        const rows = JSON.parse(raw) as UsageRow[];
        // Only replay what this same user recorded; a different login starts clean.
        rows.filter(r => r && r.user_id === identity!.userId && r.tenant_id === identity!.tenantId).forEach(queue.push);
    } catch { /* ignore */ }
}

function record(event: UsageRow['event'], name: string, meta: Meta = {}) {
    try {
        if (!identity || queue.disabled()) return;
        const clean = cleanName(name);
        if (!clean) return;
        queue.push({
            tenant_id: identity.tenantId,
            user_id: identity.userId,
            event,
            name: clean,
            meta,
            created_at: new Date().toISOString(),
        });
    } catch { /* never break the caller */ }
}

const flushSoon = () => { queue.flush().catch(() => {}); };

function onHide() {
    if (document.visibilityState !== 'hidden') return;
    flushSoon();
    persistPending();
}

// Clicks on anything carrying data-track="<key>" (optionally data-track-from="sidebar").
// Only the key is stored, never the element's text or any typed value.
function onDocumentClick(e: MouseEvent) {
    try {
        const target = e.target as Element | null;
        const el = target?.closest?.('[data-track]') as HTMLElement | null;
        if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
        const meta: Meta = { route: currentRoute };
        if (el.dataset.trackFrom) meta.from = cleanName(el.dataset.trackFrom);
        record('click', el.dataset.track || '', meta);
    } catch { /* ignore */ }
}

export function startUsageTracking(tenantId: string | null | undefined, userId: string | null | undefined) {
    try {
        if (!tenantId || !userId) return stopUsageTracking();
        if (identity && identity.tenantId === tenantId && identity.userId === userId) return;
        identity = { tenantId, userId };
        const key = `${tenantId}:${userId}`;
        if (key !== lastIdentityKey) { lastRoute = null; lastIdentityKey = key; }
        restorePending();
        if (!timer) timer = setInterval(flushSoon, FLUSH_MS);
        if (!listenersOn) {
            document.addEventListener('click', onDocumentClick, { capture: true, passive: true });
            document.addEventListener('visibilitychange', onHide);
            window.addEventListener('pagehide', persistPending);
            listenersOn = true;
        }
    } catch { /* ignore */ }
}

export function stopUsageTracking() {
    try {
        if (identity) flushSoon();
        identity = null;
        if (timer) { clearInterval(timer); timer = null; }
        if (listenersOn) {
            document.removeEventListener('click', onDocumentClick, { capture: true });
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', persistPending);
            listenersOn = false;
        }
    } catch { /* ignore */ }
}

// Once per actual route change; re-renders and StrictMode double effects are ignored.
export function trackPageView(pathname: string) {
    const route = normalizeRoute(pathname);
    currentRoute = route;
    if (route === lastRoute) return;
    lastRoute = route;
    record('page_view', route);
}

// For outcomes that aren't a single button tap (e.g. the status actually saved).
export function trackClick(name: string, meta: Meta = {}) {
    record('click', name, { route: currentRoute, ...meta });
}
