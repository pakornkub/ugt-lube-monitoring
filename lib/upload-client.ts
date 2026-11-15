// Browser side of POST /api/files. Returns the app's ActionResult shape.
import type { ActionResult } from '@/lib/actions/result';
import { withBase } from '@/lib/base-path';

export type UploadFields =
  | { target: 'reading'; assetId: string; period: string; kind: 'oil' | 'vib' }
  | { target: 'standard'; standardId: string };

export async function uploadFile(file: File, fields: UploadFields): Promise<ActionResult> {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  try {
    const res = await fetch(withBase('/api/files'), { method: 'POST', body: fd });
    if (res.status === 413) return { ok: false, message: 'ไฟล์ใหญ่เกินกว่าที่เซิร์ฟเวอร์รับได้' };
    return (await res.json()) as ActionResult;
  } catch {
    return { ok: false, message: 'อัปโหลดไม่สำเร็จ (network)' };
  }
}
