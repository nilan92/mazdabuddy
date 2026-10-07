import { supabase } from './supabase';

export interface PartMemoryItem {
    name: string;
    price: number;
    cost: number;
    lastUsed: number;
    count: number;
    source?: 'custom' | 'inventory';
}

export interface LaborMemoryItem {
    description: string;
    isFixed: boolean;
    hours: number;
    hourlyRate: number;
    fixedAmount: number;
    lastUsed: number;
    count: number;
}

const PARTS_KEY_PREFIX = 'mazdabuddy_mem_parts_';
const LABOR_KEY_PREFIX = 'mazdabuddy_mem_labor_';
const SYNC_KEY_PREFIX = 'mazdabuddy_mem_synced_';

const getStorageKey = (prefix: string, tenantId?: string) => {
    return `${prefix}${tenantId || 'default'}`;
};

// Safe localStorage access
const getLocalData = <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.warn('Failed to read from localStorage:', e);
        return fallback;
    }
};

const setLocalData = <T>(key: string, data: T): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to write to localStorage:', e);
    }
};

/**
 * Load parts memory from local storage
 */
export const loadPartsMemory = (tenantId?: string): PartMemoryItem[] => {
    return getLocalData<PartMemoryItem[]>(getStorageKey(PARTS_KEY_PREFIX, tenantId), []);
};

/**
 * Save parts memory to local storage
 */
export const savePartsMemory = (items: PartMemoryItem[], tenantId?: string): void => {
    // Keep max 100 items to avoid bloating storage
    const trimmed = items.slice(0, 100);
    setLocalData(getStorageKey(PARTS_KEY_PREFIX, tenantId), trimmed);
};

/**
 * Load labor memory from local storage
 */
export const loadLaborMemory = (tenantId?: string): LaborMemoryItem[] => {
    return getLocalData<LaborMemoryItem[]>(getStorageKey(LABOR_KEY_PREFIX, tenantId), []);
};

/**
 * Save labor memory to local storage
 */
export const saveLaborMemory = (items: LaborMemoryItem[], tenantId?: string): void => {
    const trimmed = items.slice(0, 100);
    setLocalData(getStorageKey(LABOR_KEY_PREFIX, tenantId), trimmed);
};

/**
 * Save or update a single part in memory
 */
export const savePartToMemory = (
    part: { name: string; price: number | string; cost: number | string },
    tenantId?: string
): void => {
    const trimmedName = (part.name || '').trim();
    if (!trimmedName) return;

    const price = Math.round(parseFloat(String(part.price)) || 0);
    const cost = Math.round(parseFloat(String(part.cost)) || 0);

    const current = loadPartsMemory(tenantId);
    const lowerName = trimmedName.toLowerCase();

    const existingIndex = current.findIndex(p => p.name.trim().toLowerCase() === lowerName);
    const now = Date.now();

    if (existingIndex >= 0) {
        const existing = current[existingIndex];
        current[existingIndex] = {
            ...existing,
            name: trimmedName, // preserve casing of the latest input
            price: price > 0 ? price : existing.price,
            cost: cost > 0 ? cost : existing.cost,
            lastUsed: now,
            count: (existing.count || 1) + 1,
            source: 'custom'
        };
    } else {
        current.unshift({
            name: trimmedName,
            price,
            cost,
            lastUsed: now,
            count: 1,
            source: 'custom'
        });
    }

    // Sort by recency & frequency
    current.sort((a, b) => b.lastUsed - a.lastUsed);
    savePartsMemory(current, tenantId);
};

/**
 * Save or update a single labor item in memory
 */
export const saveLaborToMemory = (
    labor: {
        description: string;
        isFixed: boolean;
        hours?: number | string;
        hourlyRate?: number | string;
        fixedAmount?: number | string;
    },
    tenantId?: string
): void => {
    const trimmedDesc = (labor.description || '').trim();
    if (!trimmedDesc) return;

    const hours = parseFloat(String(labor.hours)) || 1;
    const hourlyRate = Math.round(parseFloat(String(labor.hourlyRate)) || 0);
    const fixedAmount = Math.round(parseFloat(String(labor.fixedAmount)) || 0);

    const current = loadLaborMemory(tenantId);
    const lowerDesc = trimmedDesc.toLowerCase();

    const existingIndex = current.findIndex(l => l.description.trim().toLowerCase() === lowerDesc);
    const now = Date.now();

    if (existingIndex >= 0) {
        const existing = current[existingIndex];
        current[existingIndex] = {
            ...existing,
            description: trimmedDesc,
            isFixed: labor.isFixed,
            hours: hours > 0 ? hours : existing.hours,
            hourlyRate: hourlyRate > 0 ? hourlyRate : existing.hourlyRate,
            fixedAmount: fixedAmount > 0 ? fixedAmount : existing.fixedAmount,
            lastUsed: now,
            count: (existing.count || 1) + 1
        };
    } else {
        current.unshift({
            description: trimmedDesc,
            isFixed: labor.isFixed,
            hours,
            hourlyRate,
            fixedAmount: labor.isFixed ? (fixedAmount || hourlyRate) : fixedAmount,
            lastUsed: now,
            count: 1
        });
    }

    current.sort((a, b) => b.lastUsed - a.lastUsed);
    saveLaborMemory(current, tenantId);
};

/**
 * Remove a part from memory (e.g. if typo was made)
 */
export const removePartFromMemory = (name: string, tenantId?: string): PartMemoryItem[] => {
    const current = loadPartsMemory(tenantId);
    const lower = name.trim().toLowerCase();
    const updated = current.filter(p => p.name.trim().toLowerCase() !== lower);
    savePartsMemory(updated, tenantId);
    return updated;
};

/**
 * Remove a labor entry from memory
 */
export const removeLaborFromMemory = (description: string, tenantId?: string): LaborMemoryItem[] => {
    const current = loadLaborMemory(tenantId);
    const lower = description.trim().toLowerCase();
    const updated = current.filter(l => l.description.trim().toLowerCase() !== lower);
    saveLaborMemory(updated, tenantId);
    return updated;
};

/**
 * Preload and merge historical parts and labor from Supabase into memory
 * This ensures workshops with existing jobs immediately get suggestions without
 * having to re-type anything!
 */
export const syncItemMemoryFromDb = async (
    tenantId?: string,
    inventoryParts?: Array<{ id: string; name: string; selling_price_lkr?: number; cost_lkr?: number }>
): Promise<{ parts: PartMemoryItem[]; labor: LaborMemoryItem[] }> => {
    const syncKey = getStorageKey(SYNC_KEY_PREFIX, tenantId);
    const lastSyncTime = parseInt(getLocalData<string>(syncKey, '0'), 10);
    const now = Date.now();

    // Cache sync for 10 minutes to avoid redundant DB queries
    const isStale = (now - lastSyncTime) > 10 * 60 * 1000;
    
    let parts = loadPartsMemory(tenantId);
    let labor = loadLaborMemory(tenantId);

    // If memory already exists and sync is fresh, return local memory
    if (!isStale && (parts.length > 0 || labor.length > 0)) {
        return { parts, labor };
    }

    try {
        // 1. Fetch custom parts history
        const { data: dbParts } = await supabase
            .from('job_parts')
            .select('custom_name, price_at_time_lkr, cost_at_time_lkr, created_at')
            .eq('is_custom', true)
            .not('custom_name', 'is', null)
            .order('created_at', { ascending: false })
            .limit(200);

        // 2. Fetch labor history
        const { data: dbLabor } = await supabase
            .from('job_labor')
            .select('description, hours, hourly_rate_lkr, is_fixed, created_at')
            .not('description', 'is', null)
            .order('created_at', { ascending: false })
            .limit(200);

        // Merge Parts
        const partsMap = new Map<string, PartMemoryItem>();
        
        // Start with existing local parts
        for (const p of parts) {
            partsMap.set(p.name.trim().toLowerCase(), p);
        }

        // Merge inventory parts if provided
        if (inventoryParts && inventoryParts.length > 0) {
            for (const inv of inventoryParts) {
                const key = inv.name.trim().toLowerCase();
                if (!partsMap.has(key)) {
                    partsMap.set(key, {
                        name: inv.name.trim(),
                        price: Math.round(inv.selling_price_lkr || 0),
                        cost: Math.round(inv.cost_lkr || 0),
                        lastUsed: now - 86400000,
                        count: 1,
                        source: 'inventory'
                    });
                }
            }
        }

        // Merge historical DB custom parts
        if (dbParts) {
            for (const item of dbParts) {
                const name = (item.custom_name || '').trim();
                if (!name) continue;
                const key = name.toLowerCase();
                const price = Math.round(parseFloat(String(item.price_at_time_lkr)) || 0);
                const cost = Math.round(parseFloat(String(item.cost_at_time_lkr)) || 0);
                const time = item.created_at ? new Date(item.created_at).getTime() : now;

                if (partsMap.has(key)) {
                    const existing = partsMap.get(key)!;
                    partsMap.set(key, {
                        ...existing,
                        price: existing.price > 0 ? existing.price : price,
                        cost: existing.cost > 0 ? existing.cost : cost,
                        count: existing.count + 1,
                        lastUsed: Math.max(existing.lastUsed, time)
                    });
                } else {
                    partsMap.set(key, {
                        name,
                        price,
                        cost,
                        lastUsed: time,
                        count: 1,
                        source: 'custom'
                    });
                }
            }
        }

        // Merge Labor
        const laborMap = new Map<string, LaborMemoryItem>();
        for (const l of labor) {
            laborMap.set(l.description.trim().toLowerCase(), l);
        }

        if (dbLabor) {
            for (const item of dbLabor) {
                const desc = (item.description || '').trim();
                if (!desc) continue;
                const key = desc.toLowerCase();
                const hours = parseFloat(String(item.hours)) || 1;
                const rate = Math.round(parseFloat(String(item.hourly_rate_lkr)) || 0);
                const isFixed = Boolean(item.is_fixed);
                const time = item.created_at ? new Date(item.created_at).getTime() : now;

                if (laborMap.has(key)) {
                    const existing = laborMap.get(key)!;
                    laborMap.set(key, {
                        ...existing,
                        count: existing.count + 1,
                        lastUsed: Math.max(existing.lastUsed, time)
                    });
                } else {
                    laborMap.set(key, {
                        description: desc,
                        isFixed,
                        hours: isFixed ? 1 : hours,
                        hourlyRate: rate,
                        fixedAmount: isFixed ? rate : 0,
                        lastUsed: time,
                        count: 1
                    });
                }
            }
        }

        // Convert to sorted arrays
        parts = Array.from(partsMap.values()).sort((a, b) => {
            // Sort by frequency first, then recency
            if (b.count !== a.count) return b.count - a.count;
            return b.lastUsed - a.lastUsed;
        });

        labor = Array.from(laborMap.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.lastUsed - a.lastUsed;
        });

        savePartsMemory(parts, tenantId);
        saveLaborMemory(labor, tenantId);
        setLocalData(syncKey, String(now));
    } catch (e) {
        console.warn('Failed to sync item memory from DB:', e);
    }

    return { parts, labor };
};

/**
 * Filter and rank part suggestions based on search query
 */
export const getPartSuggestions = (
    query: string,
    memory: PartMemoryItem[],
    limit = 6
): PartMemoryItem[] => {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
        // Return top recently/frequently used
        return memory.slice(0, limit);
    }

    return memory
        .filter(item => item.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);

            // Exact prefix matches come first
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            // Frequency
            if (b.count !== a.count) return b.count - a.count;
            // Recency
            return b.lastUsed - a.lastUsed;
        })
        .slice(0, limit);
};

/**
 * Filter and rank labor suggestions based on search query
 */
export const getLaborSuggestions = (
    query: string,
    memory: LaborMemoryItem[],
    limit = 6
): LaborMemoryItem[] => {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
        return memory.slice(0, limit);
    }

    return memory
        .filter(item => item.description.toLowerCase().includes(q))
        .sort((a, b) => {
            const aDesc = a.description.toLowerCase();
            const bDesc = b.description.toLowerCase();
            const aStarts = aDesc.startsWith(q);
            const bStarts = bDesc.startsWith(q);

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            if (b.count !== a.count) return b.count - a.count;
            return b.lastUsed - a.lastUsed;
        })
        .slice(0, limit);
};
