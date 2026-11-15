import { getAllAssets } from '@/lib/queries/assets';
import { getLatestReadingsMany } from '@/lib/queries/readings';
import { ISSUES, assetIssues, type IssueKey } from '@/lib/asset-issues';
import type { Asset } from '@/lib/types';

// Every asset with its data issues, grouped by issue (plant-scoped like the list).
// Only each machine's latest oil reading counts.
export async function getAssetIssues(): Promise<Record<IssueKey, Asset[]>> {
  const assets = await getAllAssets();
  const latest = await getLatestReadingsMany(assets.map((a) => a.id));
  const out = Object.fromEntries(Object.keys(ISSUES).map((k) => [k, [] as Asset[]])) as Record<
    IssueKey,
    Asset[]
  >;
  for (const a of assets)
    for (const k of assetIssues(a, latest.get(a.id)?.oil ?? null)) out[k].push(a);
  return out;
}
