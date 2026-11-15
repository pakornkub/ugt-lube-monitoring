// lib/permissions.ts — permission keys, single source of truth (kit shape:
// ugt-nextjs-auth-setup/lib/permissions.ts). The keys are the ones the app has
// used since the Supabase era (resource:action); syncPermissionsIfNeeded() seeds
// them into the Permission table, Admin → Roles shows them as checkboxes.
export const PERMISSIONS = {
  // ugt-nextjs-mail-setup — key + seed in pairs
  DEV_MODE: 'dev-mode:enable',
  MAIL_TEMPLATES_MANAGE: 'mail-templates:manage',
  DATAENTRY_READ: 'dataentry:read',
  STANDARDS_READ: 'standards:read',
  STANDARDS_WRITE: 'standards:write',
  AUDIT_READ: 'audit:read',
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  SITES_MANAGE: 'sites:manage',
  SYSTEM_BYPASS_SITE_ACCESS: 'system:bypass_site_access',
  USERS_MANAGE: 'users:manage',
  REPORTS_EDIT: 'reports:edit',
  REPORTS_READ_ALL: 'reports:read_all',
  REPORTS_SEND_EMAIL: 'reports:send_email',
  REPORTS_VIEW: 'reports:view',
  ALARMS_READ: 'alarms:read',
  ALARMS_WRITE: 'alarms:write',
  ASSETS_DELETE: 'assets:delete',
  ASSETS_DELETE_ALL: 'assets:delete_all',
  ASSETS_IMPORT: 'assets:import',
  ASSETS_READ: 'assets:read',
  ASSETS_WRITE: 'assets:write',
  MAINTENANCE_WRITE: 'maintenance:write',
  READINGS_WRITE: 'readings:write',
  ATTACHMENTS_READ: 'attachments:read',
  ATTACHMENTS_WRITE: 'attachments:write',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permission definitions used to seed the database. group = admin-UI category. */
export const ALL_PERMISSIONS: Array<{ key: PermissionKey; label: string; group: string }> = [
  { key: PERMISSIONS.DEV_MODE, label: 'โหมดทดสอบอีเมล (อีเมลส่งกลับหาตัวเอง)', group: 'ระบบ' },
  { key: PERMISSIONS.MAIL_TEMPLATES_MANAGE, label: 'แก้ไขเทมเพลตอีเมล', group: 'ระบบ' },
  { key: PERMISSIONS.DATAENTRY_READ, label: 'มองเห็นเมนู ป้อนข้อมูล', group: 'ป้อนข้อมูล' },
  { key: PERMISSIONS.STANDARDS_READ, label: 'มองเห็นเมนู คลังมาตรฐาน', group: 'มาตรฐาน' },
  { key: PERMISSIONS.STANDARDS_WRITE, label: 'สร้าง / แก้ไข / ลบมาตรฐาน', group: 'มาตรฐาน' },
  { key: PERMISSIONS.AUDIT_READ, label: 'ดู Audit Trail', group: 'ระบบ' },
  { key: PERMISSIONS.NOTIFICATIONS_MANAGE, label: 'ตั้งค่าการแจ้งเตือนอีเมล', group: 'ระบบ' },
  { key: PERMISSIONS.SITES_MANAGE, label: 'จัดการโรงงาน / ประเภทเครื่องจักร', group: 'ระบบ' },
  { key: PERMISSIONS.SYSTEM_BYPASS_SITE_ACCESS, label: 'ข้ามข้อจำกัดการเข้าถึงตาม Site', group: 'ระบบ' },
  { key: PERMISSIONS.USERS_MANAGE, label: 'จัดการผู้ใช้ / Role / สิทธิ์', group: 'ระบบ' },
  { key: PERMISSIONS.REPORTS_EDIT, label: 'แก้ไขข้อความในรายงาน', group: 'รายงาน' },
  { key: PERMISSIONS.REPORTS_READ_ALL, label: 'ดูรายงานของทุกคน', group: 'รายงาน' },
  { key: PERMISSIONS.REPORTS_SEND_EMAIL, label: 'ส่งรายงานทางอีเมล', group: 'รายงาน' },
  { key: PERMISSIONS.REPORTS_VIEW, label: 'มองเห็นเมนู รายงานผู้บริหาร', group: 'รายงาน' },
  { key: PERMISSIONS.ALARMS_READ, label: 'มองเห็นเมนู ตั้งค่าแจ้งเตือน', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ALARMS_WRITE, label: 'ตั้งค่าเกณฑ์แจ้งเตือน / คะแนน', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ASSETS_DELETE, label: 'ลบเครื่องจักร', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ASSETS_DELETE_ALL, label: 'ลบเครื่องจักรทั้งหมด', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ASSETS_IMPORT, label: 'นำเข้าเครื่องจักรแบบชุด', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ASSETS_READ, label: 'มองเห็นเมนู ฐานข้อมูลเครื่องจักร', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ASSETS_WRITE, label: 'สร้าง / แก้ไขเครื่องจักร', group: 'เครื่องจักร' },
  { key: PERMISSIONS.MAINTENANCE_WRITE, label: 'บันทึกประวัติซ่อมบำรุง', group: 'เครื่องจักร' },
  { key: PERMISSIONS.READINGS_WRITE, label: 'บันทึกผลตรวจน้ำมัน / สั่นสะเทือน', group: 'เครื่องจักร' },
  { key: PERMISSIONS.ATTACHMENTS_READ, label: 'ดาวน์โหลดไฟล์แนบ', group: 'ไฟล์แนบ' },
  { key: PERMISSIONS.ATTACHMENTS_WRITE, label: 'แนบ / ลบไฟล์แนบ', group: 'ไฟล์แนบ' },
];

/** The four roles the app shipped with, and what each could do (Supabase 0023–0036). */
export const DEFAULT_ROLES: Array<{
  id: string;
  name: string;
  menuMain: string[];
  permissions: PermissionKey[];
}> = [
  {
    id: 'admin',
    name: 'ผู้ดูแลระบบ (Admin)',
    menuMain: ['/dashboard', '/assets', '/config/alarms', '/admin'],
    permissions: [
      'alarms:read',
      'alarms:write',
      'assets:delete',
      'assets:delete_all',
      'assets:import',
      'assets:read',
      'assets:write',
      'attachments:read',
      'attachments:write',
      'audit:read',
      'dataentry:read',
      'maintenance:write',
      'notifications:manage',
      'readings:write',
      'reports:edit',
      'reports:read_all',
      'reports:send_email',
      'reports:view',
      'sites:manage',
      'standards:read',
      'standards:write',
      'system:bypass_site_access',
      'users:manage',
    ],
  },
  {
    id: 'engineer',
    name: 'วิศวกร (Engineer)',
    menuMain: ['/data-entry', '/dashboard', '/assets', '/config/alarms'],
    permissions: [
      'alarms:read',
      'alarms:write',
      'assets:delete',
      'assets:import',
      'assets:read',
      'assets:write',
      'attachments:read',
      'attachments:write',
      'audit:read',
      'dataentry:read',
      'maintenance:write',
      'notifications:manage',
      'readings:write',
      'reports:edit',
      'reports:send_email',
      'reports:view',
      'sites:manage',
      'standards:read',
      'standards:write',
    ],
  },
  {
    id: 'manager',
    name: 'ผู้จัดการ (Manager)',
    menuMain: ['/reports', '/dashboard'],
    permissions: [
      'alarms:read',
      'assets:read',
      'attachments:read',
      'audit:read',
      'dataentry:read',
      'maintenance:write',
      'reports:view',
      'standards:read',
    ],
  },
  {
    id: 'viewer',
    name: 'ผู้ดูข้อมูล (Viewer)',
    menuMain: ['/dashboard', '/standards'],
    permissions: [
      'alarms:read',
      'assets:read',
      'attachments:read',
      'dataentry:read',
      'reports:view',
      'standards:read',
    ],
  },
];

/** Check whether a user holds a specific permission. */
export function hasPermission(userPermissions: string[], key: PermissionKey): boolean {
  return userPermissions.includes(key);
}
