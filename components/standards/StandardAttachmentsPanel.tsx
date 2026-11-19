'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { uploadFile } from '@/lib/upload-client';
import {
  createStandardDownloadUrl,
  deleteStandardAttachment,
  getStandardAttachments,
} from '@/lib/actions/attachments';
import { formatFileSize } from '@/lib/format';
import type { StandardAttachment } from '@/lib/types';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';

export function StandardAttachmentsPanel({
  standardId,
  canManage = false,
}: {
  standardId: string;
  canManage?: boolean;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StandardAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string>('');
  const [toDelete, setToDelete] = useState<StandardAttachment | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await getStandardAttachments(standardId);
        if (!cancelled) setFiles(list);
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [standardId]);

  async function onUpload(fileList: FileList | null) {
    const filesIn = fileList ? Array.from(fileList) : [];
    if (filesIn.length === 0) return;
    setUploading(true);
    let ok = 0;
    let failed = 0;
    let lastError = '';
    for (const file of filesIn) {
      const res = await uploadFile(file, { target: 'standard', standardId });
      if (res.ok) ok++;
      else {
        failed++;
        lastError = res.message;
      }
    }
    if (ok > 0) setFiles(await getStandardAttachments(standardId));
    toast(
      `แนบไฟล์ ${ok}/${filesIn.length}${failed ? ` (ไม่สำเร็จ ${failed}: ${lastError})` : ''}`,
      ok ? 'success' : 'error'
    );
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onDownload(a: StandardAttachment) {
    setBusyId(a.id);
    const res = await createStandardDownloadUrl(a.storage_path);
    setBusyId('');
    if (res.ok && res.url)
      window.location.assign(res.url); // served as an attachment — the page stays
    else toast(res.message, 'error');
  }

  async function onDelete(a: StandardAttachment): Promise<{ ok: true } | { error: string }> {
    setBusyId(a.id);
    const res = await deleteStandardAttachment(a.id, a.storage_path);
    setBusyId('');
    if (!res.ok) return { error: res.message };
    setFiles((prev) => prev.filter((x) => x.id !== a.id));
    return { ok: true };
  }

  return (
    <div className="rounded-lg border border-border bg-bg3/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-t3">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          ไฟล์ต้นฉบับ ({files.length})
        </span>
        {canManage && (
          <Button
            size="xs"
            variant="ghost"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              'กำลังอัปโหลด…'
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                แนบไฟล์
              </>
            )}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="py-2 text-[13px] text-t3">กำลังโหลด…</div>
      ) : files.length === 0 ? (
        <div className="py-2 text-[13px] text-t3">ยังไม่มีไฟล์แนบ — แนบ PDF ต้นฉบับของมาตรฐานได้ที่นี่</div>
      ) : (
        <div className="space-y-1">
          {files.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-sm border border-border bg-bg2 px-2 py-1 text-[14px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {a.file_name.toLowerCase().endsWith('.pdf') ? (
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{a.file_name}</span>
                <span className="text-t3">{formatFileSize(a.size_bytes)}</span>
              </span>
              <span className="flex gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={busyId === a.id}
                  onClick={() => onDownload(a)}
                  aria-label={`ดาวน์โหลด ${a.file_name}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                </Button>
                {canManage && (
                  <Button
                    size="xs"
                    variant="danger"
                    disabled={busyId === a.id}
                    onClick={() => setToDelete(a)}
                    aria-label={`ลบ ${a.file_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <ConfirmActionDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="ลบไฟล์แนบ"
        description={`ลบไฟล์ "${toDelete?.file_name ?? ''}"?`}
        confirmLabel="ลบ"
        successMessage="ลบไฟล์แนบสำเร็จ"
        action={() => (toDelete ? onDelete(toDelete) : Promise.resolve({ ok: true as const }))}
      />
    </div>
  );
}
