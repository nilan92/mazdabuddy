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

/** Trims, collapses runs of whitespace, and title-cases. Tolerates null. */
export function tidyName(value: string | null | undefined): string {
    return smartTitleCase((value ?? '').trim().replace(/\s+/g, ' '));
}
