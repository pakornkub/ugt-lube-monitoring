// Project catalog (the app's own strings that live in kit-gated files). th = source of truth.
export const appTh = {
  auditLogs: {
    title: 'Audit Trail (ประวัติการแก้ไข)',
    subtitle: 'บันทึกการเปลี่ยนแปลงข้อมูลทุกครั้ง — ใช้สอบ ISO audit + traceability',
    filterAll: 'ทั้งหมด',
    filterRbac: 'Role/สิทธิ์ เท่านั้น',
    colTime: 'เวลา',
    colUser: 'ผู้แก้',
    colDetail: 'รายละเอียด',
    empty: 'ยังไม่มีประวัติ',
  },
  upload: {
    badRequest: 'คำขอไม่ถูกต้อง',
    badPeriod: 'งวดไม่ถูกต้อง',
    badKind: 'ชนิดผลตรวจไม่ถูกต้อง',
    standardNotFound: 'ไม่พบมาตรฐานนี้',
    uploaded: 'แนบไฟล์สำเร็จ',
  },
} as const;
