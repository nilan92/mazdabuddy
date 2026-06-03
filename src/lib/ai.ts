import { supabase } from './supabase';

// All AI calls go through the ai-assist edge function.
// The OpenRouter API key never touches the frontend.

export async function generateDiagnosis(
  _apiKey: string, // kept for backwards compat, ignored — key is fetched server-side
  vehicle: string,
  description: string,
  symptoms: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: { action: 'diagnose', tenant_id: profile?.tenant_id, vehicle, description, symptoms },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.result;
}

export async function analyzeVehicleImage(
  _apiKey: string, // ignored — key fetched server-side
  base64Image: string
): Promise<{ licensePlate: string; make: string; model: string; color: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: { action: 'scan', tenant_id: profile?.tenant_id, image: base64Image },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.result;
}
