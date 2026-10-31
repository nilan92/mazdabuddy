import { NAV_ITEMS } from './navConfig';

// Friendly names for the Usage page. Unknown keys fall back to the raw key, so a new
// data-track key shows up immediately without needing a label first.
const CLICK_LABELS: Record<string, string> = {
    'job:new': 'New Job (open form)',
    'job:create': 'Create Job (submit)',
    'job:save': 'Update Job (save)',
    'job:status_change': 'Job status changed',
    'job:whatsapp': 'Job: WhatsApp customer',
    'job:sms': 'Job: send SMS',
    'invoice:create': 'Invoice created (job completed)',
    'invoice:pdf': 'Invoice: download PDF',
    'invoice:print': 'Invoice: print',
    'invoice:whatsapp': 'Invoice: share on WhatsApp',
    'invoice:status_change': 'Invoice: payment status changed',
    'quote:new': 'New Quote',
    'quote:save': 'Quote: save',
    'quote:pdf': 'Quote: download PDF',
    'quote:print': 'Quote: print',
    'quote:whatsapp': 'Quote: share on WhatsApp',
    'quote:mark_sent': 'Quote: mark sent',
    'quote:mark_accepted': 'Quote: mark accepted',
    'quote:mark_declined': 'Quote: mark declined',
    'quote:reopen': 'Quote: reopen',
    'quote:convert': 'Quote: convert to job',
    'customer:new': 'Add Customer',
    'customer:save': 'Save Customer',
    'customer:whatsapp_reminder': 'Customer: WhatsApp service reminder',
    'vehicle:save': 'Save Vehicle',
    'part:new': 'Add Part (inventory)',
    'part:save': 'Save Part (inventory)',
    'booking:start_job': 'Booking: start job',
    'booking:share_portal': 'Booking: share booking link',
};

const SCREEN_EXTRA: Record<string, string> = {
    '/scan': 'Smart Scan',
    '/super-admin': 'Super Admin',
};

export function clickLabel(key: string): string {
    return CLICK_LABELS[key] ?? key;
}

export function navLabel(key: string): string {
    if (key === 'more') return '“More” button (phone)';
    return NAV_ITEMS.find(n => n.key === key)?.label ?? key;
}

export function screenLabel(route: string): string {
    const nav = NAV_ITEMS.find(n => n.to === route);
    if (nav) return nav.label;
    if (SCREEN_EXTRA[route]) return SCREEN_EXTRA[route];
    const base = '/' + (route.split('/')[1] ?? '');
    const parent = NAV_ITEMS.find(n => n.to === base);
    if (parent && route !== base) return `${parent.label} › detail`;
    return route;
}
