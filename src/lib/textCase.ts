/**
 * Capitalises the first letter of each word — but ONLY for words that are
 * entirely lowercase.
 *
 * Blanket title-casing would wreck the makes this shop actually sees: BMW
 * becomes Bmw, KIA becomes Kia, DFSK becomes Dfsk. Leaving any word that
 * already contains a capital exactly as typed fixes the real complaint
 * (people typing "toyota corolla") without touching deliberate capitals.
 *
 *   "toyota corolla"  → "Toyota Corolla"
 *   "BMW"             → "BMW"        (unchanged)
 *   "FORD Ranger"     → "FORD Ranger" (unchanged)
 *   "o'brien"         → "O'Brien"
 *   "de silva"        → "De Silva"
 */
export function smartTitleCase(input: string): string {
    // Letter runs only, so apostrophes and hyphens act as word boundaries.
    return input.replace(/[\p{L}]+/gu, word =>
        word === word.toLowerCase()
            ? word.charAt(0).toUpperCase() + word.slice(1)
            : word,
    );
}

export const CUSTOMER_TITLES = ['Mr.', 'Ms.', 'Dr.', 'Prof.'] as const;
export type CustomerTitle = typeof CUSTOMER_TITLES[number];

/**
 * "Mr." + "Mohan" → "Mr. Mohan".
 *
 * Skips the prefix when the name already carries the title, so the legacy
 * "MR. MOHAN" record renders as-is instead of "Mr. MR. MOHAN" — no need to
 * rewrite old rows.
 */
export function withTitle(
    title: string | null | undefined,
    name: string | null | undefined,
): string {
    const n = (name ?? '').trim();
    const t = (title ?? '').trim();
    if (!t || !n) return n;
    const alreadyPrefixed = new RegExp(`^${t.replace(/\./g, '\\.')}\\s`, 'i').test(n);
    return alreadyPrefixed ? n : `${t} ${n}`;
}

/** Trims, collapses runs of whitespace, and title-cases. Tolerates null. */
export function tidyName(value: string | null | undefined): string {
    return smartTitleCase((value ?? '').trim().replace(/\s+/g, ' '));
}
