import { supabase } from './supabase';

const WORKER_URL = import.meta.env.VITE_PHOTO_WORKER_URL
    || 'https://mazdabuddy-photos.thenilan92.workers.dev';

export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.8;

/**
 * Downscale before upload. A modern phone photo is 4–8MB; a workshop only needs
 * enough detail to show a scratch or a part, so ~1600px at q0.8 lands around
 * 300KB. This is the reason no server-side image pipeline exists.
 */
export async function resizeImage(file: File): Promise<Blob> {
    // from-image applies EXIF orientation, otherwise phone photos upload rotated.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    // If the browser refuses to encode, sending the original beats losing the photo.
    return blob ?? file;
}

async function accessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not signed in');
    return token;
}

export interface UploadedPhoto { key: string; url: string }

export async function uploadJobPhoto(file: File, jobId: string): Promise<UploadedPhoto> {
    const blob = await resizeImage(file);
    const res = await fetch(`${WORKER_URL}?job_id=${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${await accessToken()}`,
            'Content-Type': blob.type || 'image/jpeg',
        },
        body: blob,
    });
    if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(detail.error ?? `Upload failed (${res.status})`);
    }
    return res.json();
}

/** Removes the object from R2. The job_photos row is deleted separately. */
export async function deleteJobPhotoObject(key: string): Promise<void> {
    const res = await fetch(`${WORKER_URL}?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(detail.error ?? `Delete failed (${res.status})`);
    }
}
