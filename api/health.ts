/**
 * GET /api/health
 * Verifica a conexão com o Neon (Postgres serverless) e garante que a tabela
 * de persistência dos tenants exista (bootstrap self-healing — dispensa
 * migração manual para o fluxo demo).
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(_req: any, res: any) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return res.status(503).json({ ok: false, reason: 'DATABASE_URL nao configurada na Vercel' });
  }
  try {
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_store (
        id         text PRIMARY KEY,
        data       jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const [row] = await sql`SELECT now() AS now, version() AS v`;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, db: 'neon', now: String(row?.now ?? '') });
  } catch (e: any) {
    return res.status(500).json({ ok: false, reason: e?.message ?? 'erro de banco' });
  }
}
