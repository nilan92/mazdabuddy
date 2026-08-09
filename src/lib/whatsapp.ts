/**
 * WhatsApp sharing.
 *
 * wa.me links cannot carry a file — WhatsApp's click-to-chat API only accepts
 * text. So attaching the PDF has to go through the Web Share API, which opens
 * the OS share sheet with the real file. The tradeoff: the share sheet picks
 * the recipient, so we can't also target the customer's number. Desktop, and
 * anything without file sharing, falls back to a wa.me chat with the summary
 * text and a plain PDF download.
 */

/** 0771234567 / +94 77 123 4567 / 771234567 → 94771234567 */
export function toSriLankanMsisdn(raw: string): string | null {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('94')) return digits.length === 11 ? digits : null;
    if (digits.startsWith('0')) return digits.length === 10 ? `94${digits.slice(1)}` : null;
    if (digits.length === 9) return `94${digits}`;
    return null;
}

export function waMeUrl(phone: string | undefined | null, text: string): string {
    const msisdn = phone ? toSriLankanMsisdn(phone) : null;
    // No usable number → open WhatsApp with the text and let the user pick a chat.
    return msisdn
        ? `https://wa.me/${msisdn}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function canShareFiles(file: File): boolean {
    return typeof navigator !== 'undefined'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] });
}

type ShareResult = 'shared' | 'fallback' | 'cancelled';

/**
 * Share the PDF itself where the platform allows it, otherwise open a wa.me
 * chat with `text` and hand the caller back 'fallback' so it can also save the
 * file. Returns 'cancelled' if the user dismissed the share sheet — the caller
 * should do nothing further in that case.
 */
export async function shareInvoice(opts: {
    file: File;
    title: string;
    text: string;
    phone?: string | null;
}): Promise<ShareResult> {
    const { file, title, text, phone } = opts;

    if (canShareFiles(file)) {
        try {
            await navigator.share({ files: [file], title, text });
            return 'shared';
        } catch (e: unknown) {
            // AbortError = user dismissed the sheet; anything else, fall through.
            if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
        }
    }

    window.open(waMeUrl(phone, text), '_blank', 'noopener');
    return 'fallback';
}

export function invoiceMessage(opts: {
    invoiceNumber: string;
    vehicle: string;
    total: number;
    shopName?: string | null;
    paymentLink?: string | null;
}): string {
    const { invoiceNumber, vehicle, total, shopName, paymentLink } = opts;
    const lines = [
        `Invoice ${invoiceNumber}`,
        vehicle,
        `Total: LKR ${total.toLocaleString()}`,
    ];
    if (paymentLink) lines.push('', `Pay here: ${paymentLink}`);
    if (shopName) lines.push('', `— ${shopName}`);
    return lines.join('\n');
}
