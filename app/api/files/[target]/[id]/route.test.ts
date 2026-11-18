// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requirePermission, requireAssetPermission, findAttachment, readStoredFile, logAudit } =
  vi.hoisted(() => ({
    requirePermission: vi.fn(),
    requireAssetPermission: vi.fn(),
    findAttachment: vi.fn(),
    readStoredFile: vi.fn(),
    logAudit: vi.fn(),
  }));
vi.mock('@/lib/actions/guards', () => ({ requirePermission, requireAssetPermission }));
vi.mock('@/lib/attachments-server', () => ({
  findAttachment,
  isTarget: (t: string) => t === 'reading',
}));
vi.mock('@/lib/storage', () => ({ readStoredFile }));
vi.mock('@/lib/actions/audit-log', () => ({ logAudit }));

import { GET } from './route';

const call = (target = 'reading', id = 'f1') =>
  GET(new Request('http://x/api/files'), { params: Promise.resolve({ target, id }) });
const ok = { ok: true };
const denied = { ok: false, error: { ok: false, message: 'no' } };

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue(ok);
  requireAssetPermission.mockResolvedValue(ok);
  findAttachment.mockResolvedValue({
    id: 'f1',
    asset_id: 'A1',
    storage_path: 'k',
    file_name: 'รายงาน.pdf',
  });
  readStoredFile.mockResolvedValue(Buffer.from('pdf'));
});

describe('GET /api/files/[target]/[id]', () => {
  it('answers 404 without attachments:read — never 403, which would confirm the id exists', async () => {
    requirePermission.mockResolvedValue(denied);
    expect((await call()).status).toBe(404);
    expect(findAttachment).not.toHaveBeenCalled();
  });

  it('answers 404 for another plant and for an unknown target', async () => {
    requireAssetPermission.mockResolvedValue(denied);
    expect((await call()).status).toBe(404);
    expect((await call('nope')).status).toBe(404);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('streams the file as an attachment and audits the download', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('Content-Disposition')).toContain('attachment;');
    expect(logAudit).toHaveBeenCalledTimes(1);
  });
});
