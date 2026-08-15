import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));

if (!isConfigured) {
  console.error("Missing Supabase Environmental Variables. Please check your .env file.");
}

const LOCK_TIMEOUT_MS = 3000;

/**
 * auth-js serialises token refreshes with the Web Locks API. In an iOS
 * standalone PWA a lock can still be held by a page iOS suspended or killed,
 * and the replacement page then waits on it forever — getSession() never
 * settles, so the app sits on the auth gate until the 30s watchdog fires.
 * Nothing to do with connectivity; the same request succeeds on retry once the
 * stale lock has gone.
 *
 * Bound the wait and continue without the lock rather than hanging. The lock
 * only prevents two tabs refreshing the same token simultaneously; losing it
 * for 3s risks a duplicate refresh, which is recoverable. Hanging is not.
 */
async function boundedLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCK_TIMEOUT_MS);

  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => fn(),
    );
  } catch (err) {
    // AbortError means we gave up waiting; the callback never ran, so running
    // it now is safe rather than a double execution.
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`[supabase] auth lock "${name}" timed out after ${LOCK_TIMEOUT_MS}ms; continuing without it`);
      return fn();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      lock: boundedLock,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
