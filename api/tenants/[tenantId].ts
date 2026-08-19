/**
 * /api/tenants/:tenantId  —  GET | PUT
 *
 * Persistência do estado de cada tenant (isolamento por chave primária = tenant_id,
 * espelhando a discriminação por tenant_id do schema normalizado em prisma/).
 *
 * GET → { data: TenantData | null, savedAt: string | null }
 * PUT { data } → upsert (ON CONFLICT DO UPDATE)
 *
 * Em produção, adicionar JWT + middleware de resolução de tenant via subdomínio
 * (X-Tenant-ID) conforme SPEC §1.2 / §1.8.
 */
import { neon } from '@neondatabase/serverless';

const TENANT_RE = /^[a-z0-9-]{2,64}$/;

export default async function handler(req: any, res: any) {
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ ok: false });

  const tenantId = String(req.query?.tenantId ?? '');
  if (!TENANT_RE.test(tenantId)) {
    return res.status(400).json({ error: 'tenant invalido' });
  }

  const sql = neon(url);

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data, updated_at FROM tenant_store WHERE id = ${tenantId}
      `;
      res.setHeader('Cache-Control', 'no-store');
      if (!rows.length) return res.status(404).json({ data: null, savedAt: null });
      return res.status(200).json({ data: rows[0].data, savedAt: String(rows[0].updated_at) });
    }

    if (req.method === 'PUT') {
      const data = req.body?.data;
      if (!data || typeof data !== 'object' || typeof data.settings !== 'object') {
        return res.status(400).json({ error: 'payload invalido' });
      }
      await sql`
        INSERT INTO tenant_store (id, data, updated_at)
        VALUES (${tenantId}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      `;
      return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'erro interno' });
  }
}
