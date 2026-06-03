import { supabase } from './supabase';

export async function sendSMS(to: string, message: string, tenantId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { action: 'send', to, message, tenant_id: tenantId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function checkSMSBalance(tenantId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { action: 'balance', tenant_id: tenantId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  // text.lk returns balance as an object — extract a readable value
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
