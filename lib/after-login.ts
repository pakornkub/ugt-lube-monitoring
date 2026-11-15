// kit: ugt-nextjs-platform 4.79.0 · ugt-nextjs-auth-setup/lib/after-login.ts
// kit-hash: 9cde10ff4fc7
// installed by ugt-nextjs-auth-setup — projects with SSO and/or LDAP
//
// สิ่งที่ทำหลัง SSO/LDAP login สำเร็จทุกครั้ง (เรียกจาก session hook ใน lib/auth.ts
// และจาก ldapLoginAction — หลังเติมข้อมูลจาก directory แล้ว):
//   2. [MAIL] ยังไม่มีบทบาท → เมลแจ้งทุกคนที่ถือ users:update ครั้งเดียวต่อคน
//
// **ห้ามทำให้ login พัง** — ทุกอย่างในไฟล์นี้กลืน error แล้ว log เท่านั้น
// คนที่ login ได้แต่ยังไม่มีบทบาท ดีกว่าคนที่ login ไม่ได้เลยเสมอ
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env'; // [MAIL]
import { PERMISSIONS } from '@/lib/permissions'; // [MAIL]
import { sendTemplatedMail } from '@/lib/email'; // [MAIL]
import { ADMIN_RECIPIENT_NAME } from '@/lib/types/mail-templates'; // [MAIL]
import { isDevEnvironment } from '@/lib/environment'; // [MAIL]

// No HR directory in this project (interview): the [DIRECTORY] pre-assigned-role part
// is removed; what is left is the once-per-user "logged in without a role" notice.
export async function afterOrgLogin({ userId }: { userId: string }): Promise<void> {
  // [MAIL] — ไม่ await: SMTP ที่ค้างอาจรอ timeout เป็นนาที login ต้องไม่รอเมล
  void notifyAdminsIfNoRole(userId).catch((error: unknown) => {
    console.error('[after-login] no-role notice not sent (login continues):', userId, error); // NOSONAR typescript:S106 — server-side error log only
  });
}

// ─── [MAIL] แจ้งแอดมินว่ามีคน login แล้วยังไม่มีบทบาท ────────────────────────
// ต้องมี ugt-nextjs-mail-setup (template `auth.user-without-role`) — ไม่มีให้ลบส่วนนี้
// + import ที่ติด [MAIL] ทั้งหมด: tab "ยังไม่มีบทบาท" กับ badge ในเมนูยังทำงานเหมือนเดิม

async function notifyAdminsIfNoRole(userId: string): Promise<void> {
  // จองก่อนส่ง — login พร้อมกันสองแท็บต้องได้เมลฉบับเดียว
  const claimed = await prisma.user.updateMany({
    where: { id: userId, roleId: null, noRoleNotifiedAt: null },
    data: { noRoleNotifiedAt: new Date() },
  });
  if (claimed.count === 0) return; // มี role แล้ว หรือแจ้งไปแล้ว

  const release = () =>
    prisma.user
      .updateMany({ where: { id: userId }, data: { noRoleNotifiedAt: null } })
      .catch(() => {});

  try {
    const [user, admins] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.user.findMany({
        // users:manage = this app's user admins (the kit's users:update)
        where: {
          userRole: { permissions: { some: { permission: { key: PERMISSIONS.USERS_MANAGE } } } },
        },
        select: { email: true },
      }),
    ]);
    const to = [...new Set(admins.map((a) => a.email).filter(Boolean))];
    if (!user || to.length === 0) {
      // ยังไม่มีแอดมิน (ก่อน /admin/setup) — ไม่มีใครให้แจ้ง ปล่อยจองไว้ให้ login ครั้งหน้าลองใหม่
      await release();
      return;
    }
    await sendTemplatedMail({
      templateKey: 'auth.user-without-role',
      to,
      // ไม่มีใคร "กด" อะไร — เป็นการ login จึงไม่มี dev mode ให้ redirect
      actor: { hasDevMode: false, email: null },
      // deploy dev ส่งถึงแอดมินจริงเหมือน prod — หัวเรื่องต้องบอกว่ามาจาก dev
      subjectPrefix: isDevEnvironment() ? '[DEV] ' : undefined,
      vars: {
        appName: env.NEXT_PUBLIC_APP_NAME ?? '',
        recipientName: ADMIN_RECIPIENT_NAME,
        userName: user.name,
        userEmail: user.email,
        usersUrl: `${env.BETTER_AUTH_URL}${env.NEXT_PUBLIC_BASE_PATH || ''}/admin/users?tab=no-role`,
      },
    });
  } catch (error) {
    await release(); // ส่งไม่ได้ = ยังไม่ได้แจ้ง — login ครั้งหน้าลองใหม่
    throw error;
  }
}
