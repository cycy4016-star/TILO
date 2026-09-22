// Client-safe multipart upload for images. The JSON apiFetch (@/lib/api-client)
// forces content-type: application/json, so image uploads go through plain
// fetch + FormData and land as `file` on the multipart routes
// (/api/store/items/[id]/image, /api/store/logo, /api/profile/image).
//
// Pass the response zod schema (shared contract) so the parsed result is proven
// at runtime, matching the apiFetch contract style.
import type { ZodType } from 'zod';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function uploadImageFile<T>(
  path: string,
  blob: Blob,
  fileName: string,
  schema: ZodType<T>,
): Promise<T> {
  const form = new FormData();
  form.append('file', blob, fileName);

  const res = await fetch(`${BASE}${path}`, { method: 'PUT', body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`uploadImageFile ${path} failed (${res.status})`, { cause: body });
  }
  return schema.parse(body);
}
