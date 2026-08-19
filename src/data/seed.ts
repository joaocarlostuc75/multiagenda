import type {
  Appointment, AppointmentStatus, BlockedTime, Client, NotificationEntry,
  PaymentRecord, Professional, Service, TenantData, User, WeeklyHours,
} from '../types';
import {
  addDaysISO, buildWeek, dayHours, dowOf, getDayHours, minToTime, overlaps,
  timeToMin, todayISO,
} from '../lib/schedule';

/* ---------------- RNG determinístico ---------------- */

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ---------------- helpers de seed ---------------- */

const stdWeek = (start: string, end: string, brk?: [string, string], sat?: [string, string]) =>
  buildWeek({
    1: dayHours(start, end, brk), 2: dayHours(start, end, brk), 3: dayHours(start, end, brk),
    4: dayHours(start, end, brk), 5: dayHours(start, end, brk),
    6: dayHours(sat ? sat[0] : start, sat ? sat[1] : end),
  });

const TEMPLATES = {
  confirmacao: 'Olá, {{cliente}}! ✅ Seu agendamento está confirmado: {{servico}} com {{profissional}} em {{data}} às {{hora}}. Até logo! — {{estabelecimento}}',
  lembrete24: 'Oi, {{cliente}}! Lembrete: amanhã ({{data}}) às {{hora}} temos {{servico}} com {{profissional}}. Te esperamos! — {{estabelecimento}}',
  lembrete2: '{{cliente}}, é hoje! Às {{hora}}: {{servico}} com {{profissional}}. Qualquer imprevisto, é só avisar. — {{estabelecimento}}',
  cancelamento: '{{cliente}}, seu agendamento de {{servico}} em {{data}} às {{hora}} foi cancelado. Fale com a gente para remarcar. — {{estabelecimento}}',
};

type ProSeed = { name: string; occupation: string; bio: string; color: string; commission: number; hours: WeeklyHours; serviceKeys: string[]; active?: boolean };
type SvcSeed = { key: string; cat: string; name: string; description: string; durationMin: number; price: number; color: string; bufferAfter?: number; maxPerDay?: number };
type CatSeed = { key: string; name: string; description: string };
type BlockSeed = { pro?: number; dayOffset: number; start: string; end: string; reason: string; weekly?: number };

function generateAppointments(
  tenantId: string,
  pros: Professional[],
  services: Service[],
  clients: Client[],
  methods: { id: string; type: string }[],
): { appointments: Appointment[]; payments: PaymentRecord[] } {
  const rng = mulberry32(hashStr(tenantId) + 11);
  const today = todayISO();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const appointments: Appointment[] = [];
  const payments: PaymentRecord[] = [];
  let n = 0;

  for (const pro of pros) {
    if (!pro.active) continue;
    const proSvcs = services.filter((s) => s.active && (s.professionalIds.length === 0 || s.professionalIds.includes(pro.id)));
    if (!proSvcs.length) continue;
    for (let off = -6; off <= 8; off++) {
      const date = addDaysISO(today, off);
      const dh = getDayHours(pro.weeklyHours, dowOf(date));
      if (dh.closed) continue;
      const open = timeToMin(dh.start);
      const close = timeToMin(dh.end);
      const target = off < 0 ? 3 : off === 0 ? 4 : 2 + Math.floor(rng() * 3);
      let cursor = open + Math.floor(rng() * 3) * 30;
      let placed = 0;
      let guard = 0;
      while (placed < target && guard++ < 40) {
        const svc = proSvcs[Math.floor(rng() * proSvcs.length)];
        const start = Math.ceil(cursor / 30) * 30;
        const end = start + svc.durationMin;
        if (end > close) break;
        if (dh.hasBreak && overlaps(start, end, timeToMin(dh.breakStart), timeToMin(dh.breakEnd))) {
          cursor = timeToMin(dh.breakEnd) + 15;
          continue;
        }
        const clash = appointments.some(
          (a) => a.professionalId === pro.id && a.date === date && overlaps(start, end, a.startMin, a.endMin),
        );
        if (clash) { cursor += 30; continue; }

        let status: AppointmentStatus;
        if (date < today) {
          const r = rng();
          status = r < 0.82 ? 'concluido' : r < 0.92 ? 'cancelado' : 'no_show';
        } else if (date === today) {
          if (end <= nowMin) status = rng() < 0.85 ? 'concluido' : 'no_show';
          else if (start <= nowMin) status = 'confirmado';
          else status = rng() < 0.55 ? 'confirmado' : 'pendente';
        } else {
          status = rng() < 0.5 ? 'confirmado' : 'pendente';
        }

        const client = clients[Math.floor(rng() * clients.length)];
        const id = `${tenantId}-a${++n}`;
        const pm = methods[Math.floor(rng() * methods.length)];
        appointments.push({
          id, clientId: client.id, professionalId: pro.id, serviceId: svc.id,
          date, startMin: start, endMin: end, status, price: svc.price,
          paymentMethodId: status === 'concluido' ? pm.id : null,
          notes: '', origin: rng() < 0.3 ? 'online' : 'interno',
          createdAt: new Date().toISOString(),
        });
        if (status === 'concluido' && pm) {
          payments.push({
            id: `${tenantId}-pg${n}`, appointmentId: id, methodId: pm.id,
            amount: svc.price, date, status: 'pago',
          });
        }
        placed++;
        cursor = end + (svc.bufferAfter ?? 0) + 15 + Math.floor(rng() * 3) * 15;
      }
    }
  }
  return { appointments, payments };
}

const DEFAULT_METHODS = (t: string) => [
  { id: `${t}-pm1`, name: 'Dinheiro', type: 'dinheiro' as const, active: true },
  { id: `${t}-pm2`, name: 'Pix', type: 'pix' as const, active: true },
  { id: `${t}-pm3`, name: 'Cartão de crédito', type: 'cartao' as const, active: true },
  { id: `${t}-pm4`, name: 'Cartão de débito', type: 'cartao' as const, active: true },
  { id: `${t}-pm5`, name: 'Transferência', type: 'transferencia' as const, active: true },
];

function buildTenant(cfg: {
  id: string; name: string; slug: string; category: string; phone: string; address: string;
  accent: string; hours: WeeklyHours; pros: ProSeed[]; cats: CatSeed[]; services: SvcSeed[];
  products: { name: string; description: string; price: number; stock: number }[];
  clients: { name: string; phone: string; email: string; tags: string[] }[];
  users: { name: string; email: string; role: User['role']; pro?: number }[];
  blocks: BlockSeed[];
}): TenantData {
  const t = cfg.id;
  const today = todayISO();

  const professionals: Professional[] = cfg.pros.map((p, i) => ({
    id: `${t}-p${i + 1}`, name: p.name, occupation: p.occupation, bio: p.bio,
    color: p.color, commission: p.commission, active: p.active ?? true,
    avatarUrl: null, weeklyHours: p.hours,
  }));

  const categories = cfg.cats.map((c) => ({ id: `${t}-c-${c.key}`, name: c.name, description: c.description }));

  const services: Service[] = cfg.services.map((s, i) => ({
    id: `${t}-s-${s.key}`, categoryId: `${t}-c-${s.cat}`, name: s.name, description: s.description,
    durationMin: s.durationMin, price: s.price, color: s.color, active: true,
    bufferBefore: 0, bufferAfter: s.bufferAfter ?? 0, maxPerDay: s.maxPerDay ?? 0,
    professionalIds: professionals.filter((_, pi) => cfg.pros[pi].serviceKeys.includes(s.key)).map((p) => p.id),
    imageUrl: null,
  }));

  const clients: Client[] = cfg.clients.map((c, i) => ({
    id: `${t}-cl${i + 1}`, name: c.name, phone: c.phone, email: c.email,
    birthdate: '', notes: '', tags: c.tags, createdAt: new Date().toISOString(),
  }));

  const paymentMethods = DEFAULT_METHODS(t);

  const gen = generateAppointments(t, professionals, services, clients, paymentMethods);

  const blocks: BlockedTime[] = [];
  let bn = 0;
  for (const b of cfg.blocks) {
    if (b.weekly) {
      const gid = `${t}-bg${++bn}`;
      for (let w = 0; w < b.weekly; w++) {
        blocks.push({
          id: `${t}-b${++bn}`, groupId: gid,
          professionalId: b.pro != null ? professionals[b.pro].id : null,
          serviceId: null, date: addDaysISO(today, b.dayOffset + w * 7),
          startMin: timeToMin(b.start), endMin: timeToMin(b.end), reason: b.reason,
        });
      }
    } else {
      blocks.push({
        id: `${t}-b${++bn}`, groupId: null,
        professionalId: b.pro != null ? professionals[b.pro].id : null,
        serviceId: null, date: addDaysISO(today, b.dayOffset),
        startMin: timeToMin(b.start), endMin: timeToMin(b.end), reason: b.reason,
      });
    }
  }

  const users: User[] = cfg.users.map((u, i) => ({
    id: `${t}-u${i + 1}`, name: u.name, email: u.email, role: u.role,
    professionalId: u.pro != null ? professionals[u.pro].id : undefined,
    status: 'ativo',
  }));

  const firstApptToday = gen.appointments.find((a) => a.date === today && a.status === 'confirmado');
  const notifications: NotificationEntry[] = [];
  if (firstApptToday) {
    const cli = clients.find((c) => c.id === firstApptToday.clientId)!;
    const svc = services.find((s) => s.id === firstApptToday.serviceId)!;
    const pro = professionals.find((p) => p.id === firstApptToday.professionalId)!;
    notifications.push({
      id: `${t}-n1`, to: cli.name, phone: cli.phone, kind: 'lembrete24',
      message: TEMPLATES.lembrete24
        .replace('{{cliente}}', cli.name).replace('{{data}}', 'hoje')
        .replace('{{hora}}', minToTime(firstApptToday.startMin)).replace('{{servico}}', svc.name)
        .replace('{{profissional}}', pro.name).replace('{{estabelecimento}}', cfg.name),
      status: 'enviada', at: new Date(Date.now() - 86400000).toISOString(),
    });
    notifications.push({
      id: `${t}-n2`, to: cli.name, phone: cli.phone, kind: 'confirmacao',
      message: TEMPLATES.confirmacao
        .replace('{{cliente}}', cli.name).replace('{{data}}', 'hoje')
        .replace('{{hora}}', minToTime(firstApptToday.startMin)).replace('{{servico}}', svc.name)
        .replace('{{profissional}}', pro.name).replace('{{estabelecimento}}', cfg.name),
      status: 'enviada', at: new Date(Date.now() - 3600000 * 5).toISOString(),
    });
  }

  return {
    settings: {
      name: cfg.name, slug: cfg.slug, category: cfg.category, phone: cfg.phone,
      address: cfg.address, timezone: 'America/Sao_Paulo', accent: cfg.accent,
      logoUrl: null, defaultHours: cfg.hours, templates: { ...TEMPLATES },
      reminders: { h24: true, h2: true },
    },
    users, professionals, categories, services,
    products: cfg.products.map((p, i) => ({
      id: `${t}-pr${i + 1}`, ...p, active: true, imageUrl: null,
    })),
    clients,
    appointments: gen.appointments,
    blocks, paymentMethods,
    payments: gen.payments,
    notifications,
    seededOn: today,
  };
}

/* ---------------- tenants ---------------- */

const auroraHours = stdWeek('09:00', '19:00', ['13:00', '14:00'], ['08:00', '14:00']);
const navalhaHours = buildWeek({
  2: dayHours('10:00', '20:00'), 3: dayHours('10:00', '20:00'), 4: dayHours('10:00', '20:00'),
  5: dayHours('10:00', '20:00'), 6: dayHours('09:00', '18:00'),
});
const vitaleHours = stdWeek('08:00', '18:00', ['12:00', '13:00'], ['08:00', '12:00']);

export function buildTenants(): Record<string, TenantData> {
  const aurora = buildTenant({
    id: 'aurora', name: 'Studio Aurora', slug: 'aurora', category: 'Salão de beleza',
    phone: '(11) 98765-2210', address: 'Rua das Acácias, 128 · Moema, São Paulo/SP',
    accent: '#a34a6d', hours: auroraHours,
    pros: [
      { name: 'Ana Souza', occupation: 'Cabeleireira', bio: 'Especialista em coloração e cortes autorais, 12 anos de experiência.', color: '#c25e7c', commission: 40, hours: auroraHours, serviceKeys: ['corte', 'coloracao', 'tratamento'] },
      { name: 'Bela Lima', occupation: 'Manicure', bio: 'Nail designer apaixonada por alongamentos e nail art.', color: '#3e8e9e', commission: 35, hours: auroraHours, serviceKeys: ['manicure', 'pedicure', 'spapes'] },
      { name: 'Carla Mendes', occupation: 'Esteticista', bio: 'Foco em cuidados faciais, massagens e bem-estar.', color: '#c98a2d', commission: 30, hours: auroraHours, serviceKeys: ['limpeza', 'sobrancelha', 'massagem'] },
    ],
    cats: [
      { key: 'cabelos', name: 'Cabelos', description: 'Cortes, cor e tratamentos' },
      { key: 'unhas', name: 'Unhas', description: 'Manicure, pedicure e spa' },
      { key: 'estetica', name: 'Estética', description: 'Pele, sobrancelhas e massagens' },
    ],
    services: [
      { key: 'corte', cat: 'cabelos', name: 'Corte & Escova', description: 'Corte personalizado com finalização em escova.', durationMin: 60, price: 120, color: '#c25e7c', bufferAfter: 10 },
      { key: 'coloracao', cat: 'cabelos', name: 'Coloração Completa', description: 'Coloração com produtos premium, inclui hidratação.', durationMin: 120, price: 280, color: '#a34a6d', bufferAfter: 15, maxPerDay: 4 },
      { key: 'tratamento', cat: 'cabelos', name: 'Tratamento Capilar', description: 'Reconstrução e hidratação profunda.', durationMin: 45, price: 95, color: '#8a5a44' },
      { key: 'manicure', cat: 'unhas', name: 'Manicure', description: 'Cuidado completo das unhas das mãos com esmaltação.', durationMin: 45, price: 60, color: '#3e8e9e' },
      { key: 'pedicure', cat: 'unhas', name: 'Pedicure', description: 'Cuidado completo dos pés com esmaltação.', durationMin: 60, price: 80, color: '#2f7483' },
      { key: 'spapes', cat: 'unhas', name: 'Spa dos Pés', description: 'Esfoliação, hidratação e massagem relaxante.', durationMin: 75, price: 110, color: '#5ba7b5' },
      { key: 'limpeza', cat: 'estetica', name: 'Limpeza de Pele', description: 'Limpeza profunda com extração e máscara calmante.', durationMin: 75, price: 150, color: '#c98a2d' },
      { key: 'sobrancelha', cat: 'estetica', name: 'Design de Sobrancelha', description: 'Modelagem com pinça e linha, inclusa henna opcional.', durationMin: 30, price: 45, color: '#b06f1e' },
      { key: 'massagem', cat: 'estetica', name: 'Massagem Relaxante', description: 'Massagem corporal completa com óleos essenciais.', durationMin: 60, price: 140, color: '#7a9a4e' },
    ],
    products: [
      { name: 'Shampoo Profissional 300ml', description: 'Linha de manutenção pós-química.', price: 49.9, stock: 15 },
      { name: 'Máscara Hidratante 250g', description: 'Hidratação intensiva semanal.', price: 65, stock: 4 },
      { name: 'Esmalte Premium', description: 'Cores da estação, longa duração.', price: 19.9, stock: 32 },
      { name: 'Kit Home Care', description: 'Shampoo + condicionador + leave-in.', price: 129, stock: 8 },
    ],
    clients: [
      { name: 'Mariana Costa', phone: '(11) 99811-2301', email: 'mari.costa@gmail.com', tags: ['vip'] },
      { name: 'Fernanda Ribeiro', phone: '(11) 98877-1020', email: 'ferribeiro@outlook.com', tags: ['recorrente'] },
      { name: 'Patrícia Gomes', phone: '(11) 97654-8899', email: 'pati.gomes@gmail.com', tags: ['novo'] },
      { name: 'Luciana Almeida', phone: '(11) 96543-7788', email: 'lu.almeida@yahoo.com', tags: ['vip', 'recorrente'] },
      { name: 'Beatriz Nunes', phone: '(11) 95432-6677', email: 'bia.nunes@gmail.com', tags: ['recorrente'] },
      { name: 'Camila Duarte', phone: '(11) 94321-5566', email: 'camis.duarte@gmail.com', tags: [] },
      { name: 'Renata Barbosa', phone: '(11) 93210-4455', email: 're.barbosa@hotmail.com', tags: ['novo'] },
      { name: 'Sofia Tanaka', phone: '(11) 92109-3344', email: 'sofia.tnk@gmail.com', tags: ['vip'] },
      { name: 'Helena Martins', phone: '(11) 91098-2233', email: 'helenam@gmail.com', tags: [] },
    ],
    users: [
      { name: 'Ana Souza', email: 'ana@studioaurora.com.br', role: 'owner' },
      { name: 'Renata Alves', email: 'renata@studioaurora.com.br', role: 'manager' },
      { name: 'Julia Prado', email: 'julia@studioaurora.com.br', role: 'receptionist' },
      { name: 'Bela Lima', email: 'bela@studioaurora.com.br', role: 'professional', pro: 1 },
    ],
    blocks: [
      { pro: 1, dayOffset: 1, start: '09:00', end: '12:00', reason: 'Consulta médica' },
      { pro: 2, dayOffset: 4, start: '09:00', end: '10:00', reason: 'Formação interna', weekly: 4 },
      { dayOffset: 6, start: '14:00', end: '16:00', reason: 'Reunião de equipe' },
    ],
  });

  const navalha = buildTenant({
    id: 'navalha', name: 'Navalha de Ouro', slug: 'navalhadeouro', category: 'Barbearia',
    phone: '(21) 97711-8432', address: 'Av. Atlântica, 2040 · Copacabana, Rio de Janeiro/RJ',
    accent: '#b07c22', hours: navalhaHours,
    pros: [
      { name: 'Zé Duarte', occupation: 'Barbeiro', bio: 'Fundador da casa. Clássicos da navalha e cortes tradicionais.', color: '#b07c22', commission: 45, hours: navalhaHours, serviceKeys: ['classico', 'navalhado', 'infantil', 'barba', 'combo', 'pigmentacao'] },
      { name: 'Marcos Vieira', occupation: 'Barbeiro', bio: 'Especialista em degradês e pigmentação de barba.', color: '#5b7db1', commission: 35, hours: navalhaHours, serviceKeys: ['classico', 'navalhado', 'infantil', 'barba', 'combo', 'pigmentacao'] },
      { name: 'Tião Rocha', occupation: 'Barbeiro', bio: 'Em licença temporária.', color: '#7a9a4e', commission: 30, hours: navalhaHours, serviceKeys: ['classico', 'barba', 'combo'], active: false },
    ],
    cats: [
      { key: 'cortes', name: 'Cortes', description: 'Clássicos e modernos' },
      { key: 'barba', name: 'Barba', description: 'Barboterapia e afins' },
    ],
    services: [
      { key: 'classico', cat: 'cortes', name: 'Corte Clássico', description: 'Tesoura e máquina com acabamento na navalha.', durationMin: 30, price: 45, color: '#b07c22' },
      { key: 'navalhado', cat: 'cortes', name: 'Corte Navalhado', description: 'Degradê preciso finalizado na navalha.', durationMin: 40, price: 55, color: '#8f651c', bufferAfter: 5 },
      { key: 'infantil', cat: 'cortes', name: 'Corte Infantil', description: 'Corte para crianças até 10 anos.', durationMin: 30, price: 40, color: '#c9a24b' },
      { key: 'barba', cat: 'barba', name: 'Barba Completa', description: 'Toalha quente, navalha e finalização com balm.', durationMin: 30, price: 40, color: '#5b7db1' },
      { key: 'combo', cat: 'barba', name: 'Corte + Barba', description: 'O combo completo da casa.', durationMin: 60, price: 75, color: '#3a678f', bufferAfter: 10 },
      { key: 'pigmentacao', cat: 'barba', name: 'Pigmentação', description: 'Disfarce de falhas na barba ou cabelo.', durationMin: 45, price: 60, color: '#6e4b7e' },
    ],
    products: [
      { name: 'Pomada Modeladora', description: 'Fixação forte, efeito matte.', price: 39.9, stock: 12 },
      { name: 'Óleo para Barba', description: 'Blend de óleos com vitamina E.', price: 29.9, stock: 7 },
      { name: 'Kit Barba Completa', description: 'Shampoo + balm + pente de madeira.', price: 89.9, stock: 3 },
    ],
    clients: [
      { name: 'Rodrigo Farias', phone: '(21) 98801-1122', email: 'ro.farias@gmail.com', tags: ['recorrente'] },
      { name: 'Thiago Moreira', phone: '(21) 97702-2233', email: 'thi.moreira@gmail.com', tags: ['vip'] },
      { name: 'Bruno Cardoso', phone: '(21) 96603-3344', email: 'brunoc@outlook.com', tags: [] },
      { name: 'Diego Santana', phone: '(21) 95504-4455', email: 'd.santana@gmail.com', tags: ['recorrente'] },
      { name: 'Felipe Arruda', phone: '(21) 94405-5566', email: 'fe.arruda@gmail.com', tags: ['novo'] },
      { name: 'Gustavo Pires', phone: '(21) 93306-6677', email: 'gu.pires@hotmail.com', tags: [] },
      { name: 'Otávio Lima', phone: '(21) 92207-7788', email: 'otavio.lima@gmail.com', tags: ['vip', 'recorrente'] },
    ],
    users: [
      { name: 'Zé Duarte', email: 'ze@navalhadeouro.com.br', role: 'owner' },
      { name: 'Léo Martins', email: 'leo@navalhadeouro.com.br', role: 'receptionist' },
      { name: 'Marcos Vieira', email: 'marcos@navalhadeouro.com.br', role: 'professional', pro: 1 },
    ],
    blocks: [
      { pro: 1, dayOffset: 3, start: '10:00', end: '20:00', reason: 'Folga' },
      { dayOffset: 8, start: '09:00', end: '12:00', reason: 'Manutenção da loja' },
    ],
  });

  const vitale = buildTenant({
    id: 'vitalle', name: 'Clínica Vitalle', slug: 'vitalle', category: 'Fisioterapia & Pilates',
    phone: '(31) 99123-4567', address: 'Rua Pernambuco, 890 · Savassi, Belo Horizonte/MG',
    accent: '#3a6ea5', hours: vitaleHours,
    pros: [
      { name: 'Dra. Paula Ferraz', occupation: 'Fisioterapeuta', bio: 'Especialista em ortopedia e reabilitação esportiva. CREFITO-4 12345.', color: '#3a6ea5', commission: 50, hours: vitaleHours, serviceKeys: ['ortopedica', 'rpg', 'drenagem', 'avaliacao'] },
      { name: 'Dr. Renato Dias', occupation: 'Fisioterapeuta', bio: 'Instrutor de Pilates clássico e contemporâneo.', color: '#7a9a4e', commission: 45, hours: vitaleHours, serviceKeys: ['ortopedica', 'pilates', 'drenagem', 'avaliacao'] },
    ],
    cats: [
      { key: 'fisio', name: 'Fisioterapia', description: 'Reabilitação e terapias manuais' },
      { key: 'pilates', name: 'Pilates & Avaliação', description: 'Aulas individuais e avaliações' },
    ],
    services: [
      { key: 'ortopedica', cat: 'fisio', name: 'Fisioterapia Ortopédica', description: 'Sessão de reabilitação musculoesquelética.', durationMin: 50, price: 130, color: '#3a6ea5' },
      { key: 'rpg', cat: 'fisio', name: 'RPG', description: 'Reeducação Postural Global individual.', durationMin: 60, price: 150, color: '#2c5a8a', bufferAfter: 10 },
      { key: 'drenagem', cat: 'fisio', name: 'Drenagem Linfática', description: 'Drenagem manual para redução de edemas.', durationMin: 60, price: 120, color: '#5b8fbf' },
      { key: 'pilates', cat: 'pilates', name: 'Pilates Individual', description: 'Aula individual com equipamentos completos.', durationMin: 50, price: 90, color: '#7a9a4e' },
      { key: 'avaliacao', cat: 'pilates', name: 'Avaliação Postural', description: 'Avaliação funcional completa com relatório.', durationMin: 40, price: 100, color: '#5f7f3a', maxPerDay: 3 },
    ],
    products: [
      { name: 'Elástico Teraband', description: 'Resistência média, para exercícios domiciliares.', price: 45, stock: 10 },
      { name: 'Bola de Pilates 65cm', description: 'Anti-estouro, com bomba de ar.', price: 79.9, stock: 5 },
    ],
    clients: [
      { name: 'Cláudia Neves', phone: '(31) 98811-9001', email: 'claudia.neves@gmail.com', tags: ['recorrente'] },
      { name: 'André Siqueira', phone: '(31) 97722-9002', email: 'andre.siq@gmail.com', tags: ['novo'] },
      { name: 'Vera Lúcia Prado', phone: '(31) 96633-9003', email: 'vera.prado@yahoo.com', tags: ['vip'] },
      { name: 'Henrique Sales', phone: '(31) 95544-9004', email: 'h.sales@gmail.com', tags: ['recorrente'] },
      { name: 'Tereza Camargo', phone: '(31) 94455-9005', email: 'tere.camargo@gmail.com', tags: ['vip', 'recorrente'] },
      { name: 'Paulo Henrique Cruz', phone: '(31) 93366-9006', email: 'ph.cruz@gmail.com', tags: [] },
    ],
    users: [
      { name: 'Dra. Paula Ferraz', email: 'paula@vitalle.com.br', role: 'owner' },
      { name: 'Dr. Renato Dias', email: 'renato@vitalle.com.br', role: 'manager', pro: 1 },
    ],
    blocks: [
      { pro: 0, dayOffset: 2, start: '08:00', end: '12:00', reason: 'Congresso de fisioterapia' },
      { pro: 1, dayOffset: 5, start: '14:00', end: '18:00', reason: 'Curso de Pilates', weekly: 3 },
    ],
  });

  return { aurora, navalha, vitale };
}

export const TENANT_LIST = [
  { id: 'aurora', name: 'Studio Aurora', category: 'Salão de beleza' },
  { id: 'navalha', name: 'Navalha de Ouro', category: 'Barbearia' },
  { id: 'vitalle', name: 'Clínica Vitalle', category: 'Fisioterapia & Pilates' },
];
