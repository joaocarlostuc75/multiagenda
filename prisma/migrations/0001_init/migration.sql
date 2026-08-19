-- Agendou — migração inicial (multi-tenant, SPEC §1.2 / §1.8)
-- Banco-alvo: Neon Postgres. Alternativa ao `prisma migrate deploy` (schema.prisma).

-- ------------------------------------------------------------ persistência demo
CREATE TABLE IF NOT EXISTS tenant_store (
  id         text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------- tabelas
CREATE TABLE IF NOT EXISTS tenants (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  category    text NOT NULL DEFAULT '',
  phone       text NOT NULL DEFAULT '',
  address     text NOT NULL DEFAULT '',
  timezone    text NOT NULL DEFAULT 'America/Sao_Paulo',
  accent      text NOT NULL DEFAULT '#157f63',
  logo_url    text,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'active',
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professionals (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  bio                 text NOT NULL DEFAULT '',
  avatar_url          text,
  occupation          text NOT NULL DEFAULT '',
  color               text NOT NULL DEFAULT '#157f63',
  active              boolean NOT NULL DEFAULT true,
  commission_percent  integer NOT NULL DEFAULT 0,
  weekly_hours        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_professionals_tenant ON professionals(tenant_id);

CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL DEFAULT '',
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'receptionist',
  professional_id text REFERENCES professionals(id) ON DELETE SET NULL,
  active          boolean NOT NULL DEFAULT true,
  avatar_url      text,
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

CREATE TABLE IF NOT EXISTS working_hours (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week     integer NOT NULL,
  start_time      text NOT NULL,
  end_time        text NOT NULL,
  break_start     text,
  break_end       text,
  UNIQUE (tenant_id, professional_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_working_hours_tenant ON working_hours(tenant_id);

CREATE TABLE IF NOT EXISTS service_categories (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url   text
);
CREATE INDEX IF NOT EXISTS idx_service_categories_tenant ON service_categories(tenant_id);

CREATE TABLE IF NOT EXISTS services (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id       text NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  duration_min      integer NOT NULL,
  price             numeric(10,2) NOT NULL,
  color             text NOT NULL DEFAULT '#157f63',
  image_urls        text[] NOT NULL DEFAULT '{}',
  active            boolean NOT NULL DEFAULT true,
  buffer_before_min integer NOT NULL DEFAULT 0,
  buffer_after_min  integer NOT NULL DEFAULT 0,
  max_per_day       integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_cat ON services(tenant_id, category_id);

CREATE TABLE IF NOT EXISTS service_professionals (
  service_id      text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, professional_id)
);

CREATE TABLE IF NOT EXISTS products (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  price       numeric(10,2) NOT NULL,
  stock       integer NOT NULL DEFAULT 0,
  image_urls  text[] NOT NULL DEFAULT '{}',
  active      boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

CREATE TABLE IF NOT EXISTS clients (
  id         text PRIMARY KEY,
  tenant_id  text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL DEFAULT '',
  phone      text NOT NULL,
  birthdate  date,
  notes      text NOT NULL DEFAULT '',
  tags       text[] NOT NULL DEFAULT '{}',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_phone ON clients(tenant_id, phone);

CREATE TABLE IF NOT EXISTS appointments (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id         text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  professional_id   text NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  service_id        text NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_time        timestamptz NOT NULL,
  end_time          timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'pendente',
  price             numeric(10,2) NOT NULL,
  payment_method_id text,
  notes             text NOT NULL DEFAULT '',
  origin            text NOT NULL DEFAULT 'interno',
  location          text NOT NULL DEFAULT '',
  external_ref      text,
  created_by        text,
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pendente','confirmado','concluido','cancelado','no_show')),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start ON appointments(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_pro_start ON appointments(tenant_id, professional_id, start_time);

CREATE TABLE IF NOT EXISTS blocked_times (
  id               text PRIMARY KEY,
  tenant_id        text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  professional_id  text REFERENCES professionals(id) ON DELETE CASCADE,
  service_id       text REFERENCES services(id) ON DELETE CASCADE,
  start_time       timestamptz NOT NULL,
  end_time         timestamptz NOT NULL,
  reason           text NOT NULL DEFAULT '',
  recurrence_rule  text, -- RRULE (iCal)
  group_id         text,
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_blocked_tenant_start ON blocked_times(tenant_id, start_time);

CREATE TABLE IF NOT EXISTS payment_methods (
  id        text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,
  type      text NOT NULL,
  active    boolean NOT NULL DEFAULT true,
  CHECK (type IN ('dinheiro','pix','cartao','transferencia'))
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);

ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_pm
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS payment_records (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id text NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  method_id      text NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  amount         numeric(10,2) NOT NULL,
  status         text NOT NULL DEFAULT 'pago',
  paid_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_paid ON payment_records(tenant_id, paid_at);

CREATE TABLE IF NOT EXISTS media (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  url         text NOT NULL,
  thumb_url   text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_tenant_entity ON media(tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notifications (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id text,
  type           text NOT NULL,
  channel        text NOT NULL DEFAULT 'whatsapp',
  status         text NOT NULL DEFAULT 'pendente',
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at        timestamptz,
  error          text
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_sent ON notifications(tenant_id, sent_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      text REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    text NOT NULL,
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs(tenant_id, created_at);

-- ------------------------------------------------- Row Level Security (SPEC §1.2)
-- A API define `SET app.tenant_id = '<id>'` por conexão/requisição antes de operar.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','professionals','working_hours','service_categories','services',
    'products','clients','appointments','blocked_times','payment_methods',
    'payment_records','media','notifications','audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_setting(''app.tenant_id'', true))
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;
