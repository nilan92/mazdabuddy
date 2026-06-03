import { supabase } from './supabase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/mazdabuddy/sw.js', { scope: '/mazdabuddy/' });
    return reg;
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

export async function subscribeToPush(userId: string, tenantId: string): Promise<boolean> {
  if (!('PushManager' in window) || !VAPID_PUBLIC) return false;

  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Check for existing subscription
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as ArrayBuffer,
      });
    }

    const key = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    if (!key || !auth) return false;

    // Save subscription to Supabase
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      tenant_id: tenantId,
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth_key: btoa(String.fromCharCode(...new Uint8Array(auth))),
    }, { onConflict: 'user_id,endpoint' });

    return true;
  } catch (e) {
    console.warn('Push subscription failed:', e);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/mazdabuddy/sw.js');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', userId).eq('endpoint', sub.endpoint);
    }
  } catch (e) {
    console.warn('Unsubscribe failed:', e);
  }
}

export async function sendPushNotification(opts: {
  tenantId: string;
  userIds?: string[];
  title: string;
  body: string;
  tag?: string;
  url?: string;
}) {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: {
      tenant_id: opts.tenantId,
      user_ids: opts.userIds,
      title: opts.title,
      body: opts.body,
      tag: opts.tag,
      url: opts.url,
    },
  });
  if (error) console.warn('Push send failed:', error.message);
  return data;
}
