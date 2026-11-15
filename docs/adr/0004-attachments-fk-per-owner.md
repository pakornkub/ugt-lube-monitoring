# 0004 — Attachments: one table per owner (FK), files on a Docker volume

Date: 2026-11-15 · Status: accepted

Two owners only (a machine's lab reading, a standard) and both existed as tables, so the attachment link is a
real foreign key per owner (`ReadingAttachments`, `StandardAttachments`; pattern B of upload-setup), not the
kit's polymorphic `Attachments`. Deleting a machine/standard removes its rows by cascade. Files live under
`STORAGE_ROOT` (bind mount `/home/docker02/appdata/<project>/storage`), named by a generated key. Upload
`POST /api/files`, download `GET /api/files/<reading|standard>/<id>` (permission + plant scope, 404 for
missing or not allowed, always `attachment`). Permissions stay the app's `attachments:read` /
`attachments:write`. Delete = soft delete; `/api/cron/attachments-sweep` removes bytes after 90 days. No
virus scan (owner's choice; 25 MB limit at the proxy).
