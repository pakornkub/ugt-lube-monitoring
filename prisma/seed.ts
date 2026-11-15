// prisma/seed.ts — reference data + the 569 real machines (Final equipment in
// program.xlsx), the same rows the Supabase migrations 0002…0036 seeded.
// Idempotent: reference rows are upserted only when missing, machines are inserted
// only when their id is new — it never overwrites anything an admin changed.
// Roles are NOT seeded here: the first login creates them at /admin/setup.
// Run: npx prisma db seed   (prisma.config.ts → migrations.seed)
// Run through `npx prisma db seed`: the Prisma CLI loads .env/.env.local (prisma.config.ts)
// and passes them on, so the app's own client and env validation apply here too.
import { prisma } from '@/lib/prisma';
import data from './seed-data/reference.json';
import { ALL_PERMISSIONS } from '@/lib/permissions';

const BY = 'seed';

async function main() {
  for (const s of data.sites) {
    await prisma.site.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, created_by: BY },
    });
  }
  for (const t of data.asset_types) {
    await prisma.assetType.upsert({
      where: { name: t.name },
      update: {},
      create: { ...t, created_by: BY },
    });
  }
  for (const p of data.alarm_params) {
    await prisma.alarmParam.upsert({
      where: { category_key: { category: p.category, key: p.key } },
      update: {},
      create: p,
    });
  }
  await prisma.scoreConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...data.score_config },
  });
  await prisma.notificationConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await prisma.standard.count()) === 0) {
    for (const s of data.standards) {
      await prisma.standard.create({
        data: {
          ...s,
          tags: JSON.stringify(s.tags ?? []),
          related_params: JSON.stringify(s.related_params ?? []),
          asset_types: JSON.stringify(s.asset_types ?? []),
          created_by: BY,
        },
      });
    }
  }

  const existing = new Set(
    (await prisma.asset.findMany({ select: { id: true } })).map((a) => a.id)
  );
  for (const a of data.assets) {
    if (existing.has(a.id)) continue;
    await prisma.asset.create({
      data: {
        ...a,
        install_date: a.install_date ? new Date(`${a.install_date}T00:00:00Z`) : null,
        created_by: BY,
      },
    });
  }

  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: p,
    });
  }
  console.log(`seed: ${data.assets.length - existing.size} new machine(s), reference data ready`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
