# Agendou — Agendamento online multi-tenant

SaaS de agendamento para estabelecimentos de serviços pessoais (salões, barbearias,
clínicas de fisioterapia, esteticistas…). Painel administrativo completo, agenda visual
(dia/semana/mês com drag-and-drop), portal público de agendamento, notificações
WhatsApp simuladas e isolamento total por tenant.

**Stack deste repositório:** Vite + React + TypeScript + TailwindCSS v4 no frontend,
Vercel Functions (`/api`) no backend e **Neon (Postgres serverless)** como banco.

---

## 1. Rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173 — modo "armazenamento local"
```

Sem backend configurado, o app funciona 100% offline: os dados ficam no navegador e o
indicador na topbar mostra **"armazenamento local"**.

## 2. Criar o banco no Neon

1. Crie um projeto em [neon.tech](https://neon.tech) (ex.: `agendou`, região mais próxima).
2. Em **Connect**, copie:
   - a **pooled connection string** (modo *Transaction*) → `DATABASE_URL`
   - a **direct connection string** → `DIRECT_URL`

O app cria a tabela de persistência automaticamente no primeiro acesso
(`GET /api/health` executa `CREATE TABLE IF NOT EXISTS tenant_store`).

### (Opcional) schema normalizado com Prisma

O modelo de dados completo da SPEC (tenants, users, professionals, appointments,
bloqueios, pagamentos, media, notificações, auditoria) está em `prisma/schema.prisma`,
com migração SQL em `prisma/migrations/0001_init/migration.sql` — incluindo **Row Level
Security** com política `tenant_isolation` por tabela.

```bash
npm i -D prisma @prisma/client
npx prisma migrate deploy        # usa DATABASE_URL / DIRECT_URL do .env
# ou aplique só o SQL: psql "$DIRECT_URL" -f prisma/migrations/0001_init/migration.sql
```

## 3. Deploy na Vercel

### Via GitHub (recomendado)

1. Suba o repositório para o GitHub.
2. Em [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório.
3. Framework detectado: **Vite**. Build: `npm run build` · Output: `dist`.
4. Em **Settings → Environment Variables**, adicione `DATABASE_URL` e `DIRECT_URL`
   (valores do `.env.example`).
5. **Deploy**. A cada push, produção atualiza automaticamente.

### Via CLI

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL   # cole a pooled connection do Neon
vercel env add DIRECT_URL
vercel --prod
```

O `vercel.json` já configura o rewrite SPA (`/qualquer-rota → index.html`) e as
functions em `api/` (256 MB · 10 s).

## 4. Como a sincronização funciona

```
┌──────────────┐  GET /api/health        ┌────────────────┐  SQL  ┌────────┐
│  App (React) │ ───────────────────────▶│ Vercel Function│ ─────▶│  Neon  │
│  localStorage│  GET/PUT /api/tenants/  │ @neondatabase/ │       │ (Postgres
│  (cache)     │        :tenantId        │ serverless     │       │ serverless)
└──────────────┘                         └────────────────┘       └────────┘
```

- **Boot:** o app faz health check (2 s de timeout). Com Neon ativo, puxa o estado do
  tenant da nuvem (a nuvem é a fonte de verdade entre dispositivos). Sem backend, roda
  em modo local.
- **Escrita:** toda mutação persiste no localStorage imediatamente e é enviada ao Neon
  com debounce de ~1 s (`PUT /api/tenants/:id` → upsert JSONB).
- **Troca de tenant:** pull isolado por `tenant_id` — um tenant nunca enxerga dados de
  outro (mesma discriminação do schema normalizado + RLS).
- **Indicador ao vivo** na topbar: `verificando nuvem… → salvando no Neon… → Neon ·
  sincronizado` (ou `armazenamento local` / retry em caso de falha).

### Seed

Não há passo manual de seed: no primeiro acesso com Neon ativo, o app sobe o estado
demo determinístico (3 tenants, ~15 dias de agenda relativa à data atual) para a nuvem.
Para um tenant novo em produção, o onboarding criaria a linha via `POST /tenants`.

## 5. Estrutura

```
api/                     Vercel Functions (Node) — @neondatabase/serverless
  health.ts              health check + bootstrap da tabela tenant_store
  tenants/[tenantId].ts  GET/PUT do estado isolado do tenant
prisma/
  schema.prisma          modelo completo da SPEC (15 entidades)
  migrations/0001_init/  DDL + índices + políticas RLS
src/
  store.tsx              estado global + lifecycle de sync nuvem/local
  lib/cloudSync.ts       adaptador fetch → /api (fallback silencioso)
  lib/schedule.ts        motor de horários, disponibilidade e conflitos
  data/seed.ts           seed determinístico por tenant
  pages/                 Dashboard, Agenda, Horas, Bloqueios, CRUDs, Portal…
vercel.json              rewrite SPA + config das functions
```

## 6. Próximos passos (evolução)

- Autenticação JWT + bcrypt + Google OAuth (SPEC §1.8) e resolução de tenant por
  subdomínio no middleware das functions.
- Fila de lembretes (24 h / 2 h) com Vercel Cron + WhatsApp Business Cloud API.
- Uploads via presigned URLs (S3/R2) registrando em `media`.
- Auditoria (`audit_logs`) em todas as mutações administrativas.
