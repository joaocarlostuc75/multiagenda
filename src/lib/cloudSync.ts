import type { TenantData } from '../types';

/**
 * Adaptador de sincronização com as Vercel Functions (api/) → Neon Postgres.
 * - Sem backend (localhost / preview estático): tudo cai silenciosamente no
 *   armazenamento local — o app continua 100% funcional.
 * - Na Vercel com DATABASE_URL: o tenant vira fonte de verdade na nuvem.
 */

const withTimeout = (ms: number) => {
  const c = new AbortController();
  window.setTimeout(() => c.abort(), ms);
  return c.signal;
};

export async function checkCloud(): Promise<boolean> {
  try {
    const r = await fetch('/api/health', { signal: withTimeout(2200) });
    if (!r.ok) return false;
    const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    return !!j && j.ok === true;
  } catch {
    return false;
  }
}

export async function loadTenant(id: string): Promise<{ data: TenantData | null; savedAt: string | null }> {
  try {
    const r = await fetch(`/api/tenants/${encodeURIComponent(id)}`, { signal: withTimeout(7000) });
    if (!r.ok) return { data: null, savedAt: null };
    const j = (await r.json().catch(() => null)) as { data?: TenantData; savedAt?: string } | null;
    return { data: j?.data ?? null, savedAt: j?.savedAt ?? null };
  } catch {
    return { data: null, savedAt: null };
  }
}

export async function saveTenant(id: string, data: TenantData): Promise<boolean> {
  try {
    const r = await fetch(`/api/tenants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: withTimeout(7000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
