/**
 * MazdaBuddy job-photo upload authoriser.
 *
 * R2 has no row-level security, so every write is authorised here and every
 * object key is prefixed with the caller's tenant. The tenant is never taken
 * from the request — it's read back from Supabase using the caller's own token,
 * so a forged body cannot place objects in another workshop's prefix.
 *
 * Reads are public (unguessable UUID keys) by product decision, so there is no
 * read path here — the browser fetches straight from the bucket's public domain.
 */

interface Env {
    PHOTOS: R2Bucket;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    PUBLIC_BASE: string;
    ALLOWED_ORIGINS: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 8 * 1024 * 1024; // client resizes to ~300KB; this is a backstop
const EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};

function corsHeaders(origin: string | null, env: Env): HeadersInit {
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    const ok = origin && allowed.includes(origin);
    return {
        'Access-Control-Allow-Origin': ok ? origin : allowed[0],
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

const json = (body: unknown, status: number, headers: HeadersInit) =>
    new Response(JSON.stringify(body), {
        status, headers: { ...headers, 'content-type': 'application/json' },
    });

/** Unverified read of the `sub` claim — only used to pick which row to ask for.
 *  Authority comes from Supabase accepting or rejecting the token below. */
function subjectOf(token: string): string | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return typeof claims.sub === 'string' && UUID.test(claims.sub) ? claims.sub : null;
    } catch { return null; }
}

async function tenantOf(token: string, env: Env): Promise<string | null> {
    const sub = subjectOf(token);
    if (!sub) return null;
    const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/profiles?select=tenant_id&id=eq.${sub}`,
        { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null; // invalid/expired token → Supabase rejects it
    const rows = await res.json<{ tenant_id: string }[]>();
    return rows?.[0]?.tenant_id ?? null;
}

/** RLS means a job the caller cannot see simply doesn't come back. */
async function jobIsVisible(jobId: string, token: string, env: Env): Promise<boolean> {
    const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/job_cards?select=id&id=eq.${jobId}`,
        { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return false;
    return (await res.json<{ id: string }[]>()).length > 0;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const cors = corsHeaders(request.headers.get('Origin'), env);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

        const auth = request.headers.get('Authorization') ?? '';
        if (!auth.startsWith('Bearer ')) return json({ error: 'Missing token' }, 401, cors);
        const token = auth.slice(7);

        const tenantId = await tenantOf(token, env);
        if (!tenantId) return json({ error: 'Not authorised' }, 401, cors);

        const url = new URL(request.url);

        if (request.method === 'POST') {
            const jobId = url.searchParams.get('job_id') ?? '';
            if (!UUID.test(jobId)) return json({ error: 'job_id must be a uuid' }, 400, cors);
            if (!await jobIsVisible(jobId, token, env)) return json({ error: 'Job not found' }, 404, cors);

            const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0];
            const ext = EXT[contentType];
            if (!ext) return json({ error: 'Only jpeg, png or webp' }, 415, cors);

            const body = await request.arrayBuffer();
            if (body.byteLength === 0) return json({ error: 'Empty body' }, 400, cors);
            if (body.byteLength > MAX_BYTES) return json({ error: 'Image too large' }, 413, cors);

            const key = `tenants/${tenantId}/jobs/${jobId}/${crypto.randomUUID()}.${ext}`;
            await env.PHOTOS.put(key, body, {
                httpMetadata: {
                    contentType,
                    cacheControl: 'public, max-age=31536000, immutable',
                },
            });

            return json({ key, url: `${env.PUBLIC_BASE}/${key}` }, 200, cors);
        }

        if (request.method === 'DELETE') {
            const key = url.searchParams.get('key') ?? '';
            // The prefix check is the whole authorisation: a caller can only ever
            // delete inside their own tenant's namespace.
            if (!key.startsWith(`tenants/${tenantId}/`)) {
                return json({ error: 'Not authorised for this object' }, 403, cors);
            }
            await env.PHOTOS.delete(key);
            return json({ deleted: key }, 200, cors);
        }

        return json({ error: 'Method not allowed' }, 405, cors);
    },
};
