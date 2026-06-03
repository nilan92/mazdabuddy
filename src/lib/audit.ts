import { supabase } from './supabase';

export async function logAudit(
  tenantId: string,
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      meta: meta ?? {},
    });
  } catch {
    // Audit failures must never break the main flow
  }
}
