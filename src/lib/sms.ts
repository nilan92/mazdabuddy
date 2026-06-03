import { supabase } from './supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

async function invokeFn(fnName: string, body: object): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? ANON_KEY;

  const res = await fetch(`${FUNCTIONS_URL}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Edge function HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendSMS(to: string, message: string, tenantId: string): Promise<void> {
  await invokeFn('send-sms', { action: 'send', to, message, tenant_id: tenantId });
}

export async function checkSMSBalance(tenantId: string): Promise<string> {
  const data = await invokeFn('send-sms', { action: 'balance', tenant_id: tenantId });
  const b = data?.balance;
  if (typeof b === 'object' && b !== null) {
    return b.sms_unit ?? b.balance ?? b.remaining ?? JSON.stringify(b);
  }
  return String(b ?? 'Unknown');
}

// Pre-built message templates
export const smsTemplates = {
  jobCreated: (customerName: string, make: string, model: string, plate: string, shopName: string) =>
    `Hi ${customerName.split(' ')[0]}, your ${make} ${model} (${plate}) has been checked in at ${shopName}. We'll update you as work progresses.`,

  jobInProgress: (customerName: string, make: string, model: string, plate: string, shopName: string) =>
    `Hi ${customerName.split(' ')[0]}, work has started on your ${make} ${model} (${plate}) at ${shopName}. We'll notify you when it's ready.`,

  jobCompleted: (customerName: string, make: string, model: string, plate: string, shopName: string, phone: string) =>
    `Hi ${customerName.split(' ')[0]}, your ${make} ${model} (${plate}) is ready for pickup at ${shopName}. Call us: ${phone}`,

  serviceReminder: (customerName: string, make: string, model: string, plate: string, shopName: string, phone: string) =>
    `Hi ${customerName.split(' ')[0]}, your ${make} ${model} (${plate}) is due for a service check. Book now with ${shopName}: ${phone}`,
};
