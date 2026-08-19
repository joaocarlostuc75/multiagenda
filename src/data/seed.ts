import type { TenantData, User } from '../types';
import { buildWeek, dayHours, uid } from '../lib/schedule';

/** Templates padrão de mensagens WhatsApp (editáveis por tenant). */
export const TEMPLATES = {
  confirmacao: 'Olá, {{cliente}}! ✅ Seu agendamento está confirmado: {{servico}} com {{profissional}} em {{data}} às {{hora}}. Até logo! — {{estabelecimento}}',
  lembrete24: 'Oi, {{cliente}}! Lembrete: amanhã ({{data}}) às {{hora}} temos {{servico}} com {{profissional}}. Te esperamos! — {{estabelecimento}}',
  lembrete2: '{{cliente}}, é hoje! Às {{hora}}: {{servico}} com {{profissional}}. Qualquer imprevisto, é só avisar. — {{estabelecimento}}',
  cancelamento: '{{cliente}}, seu agendamento de {{servico}} em {{data}} às {{hora}} foi cancelado. Fale com a gente para remarcar. — {{estabelecimento}}',
};

const DEFAULT_METHODS = (t: string) => [
  { id: `${t}-pm1`, name: 'Dinheiro', type: 'dinheiro' as const, active: true },
  { id: `${t}-pm2`, name: 'Pix', type: 'pix' as const, active: true },
  { id: `${t}-pm3`, name: 'Cartão de crédito', type: 'cartao' as const, active: true },
  { id: `${t}-pm4`, name: 'Cartão de débito', type: 'cartao' as const, active: true },
  { id: `${t}-pm5`, name: 'Transferência', type: 'transferencia' as const, active: true },
];

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'meu-negocio';

const defaultWeek = () =>
  buildWeek({
    1: dayHours('09:00', '19:00', ['13:00', '14:00']),
    2: dayHours('09:00', '19:00', ['13:00', '14:00']),
    3: dayHours('09:00', '19:00', ['13:00', '14:00']),
    4: dayHours('09:00', '19:00', ['13:00', '14:00']),
    5: dayHours('09:00', '19:00', ['13:00', '14:00']),
    6: dayHours('09:00', '14:00'),
  });

export const PLACEHOLDER_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'professional',
  passwordHash: '',
  status: 'ativo',
};

export function createOwner(name: string, email: string, passwordHash: string): User {
  return { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), role: 'owner', passwordHash, status: 'ativo' };
}

export type NewTenantInput = {
  name: string;
  slug: string;
  category: string;
  phone: string;
  address: string;
  timezone: string;
  accent: string;
  owner: User;
};

/** Cria um tenant 100% vazio: sem clientes, agenda, serviços ou profissionais. */
export function createEmptyTenant(o: NewTenantInput): TenantData {
  const t = o.slug;
  return {
    settings: {
      name: o.name,
      slug: t,
      category: o.category,
      phone: o.phone,
      address: o.address,
      timezone: o.timezone,
      accent: o.accent,
      logoUrl: null,
      defaultHours: defaultWeek(),
      templates: { ...TEMPLATES },
      reminders: { h24: true, h2: true },
    },
    users: [o.owner],
    professionals: [],
    categories: [],
    services: [],
    products: [],
    clients: [],
    appointments: [],
    blocks: [],
    paymentMethods: DEFAULT_METHODS(t),
    payments: [],
    notifications: [],
  };
}

/** Tenant em branco usado como fallback de tipagem antes do login. */
export function emptyTenant(): TenantData {
  return createEmptyTenant({
    name: '',
    slug: '',
    category: '',
    phone: '',
    address: '',
    timezone: 'America/Sao_Paulo',
    accent: '#157f63',
    owner: PLACEHOLDER_USER,
  });
}
