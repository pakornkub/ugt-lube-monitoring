import { getSessionUser } from '@/lib/profile';

// Shared in-memory rate limiter for AI endpoints (per server instance).
// A real LLM call costs money, so logged-in users must not be able to fire
// unlimited requests. On serverless this still throttles per instance.
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    const rec = hits.get(key);
    if (!rec || now > rec.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    rec.count += 1;
    return rec.count > limit;
  };
}

// Rate-limit key: the signed-in user, so the cap is per person — not per office
// NAT, and not dodged by sending a different x-forwarded-for.
// shortcut: counts live in each server instance's memory, so N instances allow N× the cap; move them to a shared store (e.g. a SQL Server table) if AI spend grows.
export async function rateKey(request: Request): Promise<string> {
  const user = await getSessionUser();
  if (user) return `user:${user.id}`;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  return `ip:${ip}`;
}
