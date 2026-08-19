import type {
  Appointment, BlockedTime, Client, DayHours, Service, WeeklyHours,
} from '../types';

/* ================= datas ================= */

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const minToTime = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

export const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const todayISO = () => toISO(new Date());

export const addDaysISO = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const dowOf = (iso: string) => fromISO(iso).getDay();

export const startOfWeekISO = (iso: string) => {
  const d = fromISO(iso);
  const diff = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - diff);
  return toISO(d);
};

export const weekDaysOf = (iso: string) => {
  const mon = startOfWeekISO(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i));
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const nextDays = (fromIso: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDaysISO(fromIso, i));

export const DOW_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const DOW_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
/** ordem de exibição: segunda → domingo */
export const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const fmtDayLong = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromISO(iso));

export const fmtShort = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export const fmtShortDow = (iso: string) => `${DOW_SHORT[dowOf(iso)]}, ${fmtShort(iso)}`;

export const monthLabel = (iso: string) => {
  const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(fromISO(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

let seq = 0;
export const uid = () => `id${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

/* ================= horários de funcionamento ================= */

export const dayHours = (start: string, end: string, brk?: [string, string]): DayHours => ({
  closed: false, start, end,
  hasBreak: !!brk,
  breakStart: brk ? brk[0] : '12:00',
  breakEnd: brk ? brk[1] : '13:00',
});

export const closedDay = (): DayHours => ({
  closed: true, start: '09:00', end: '18:00', hasBreak: false, breakStart: '12:00', breakEnd: '13:00',
});

export const buildWeek = (spec: Partial<Record<number, DayHours>>): WeeklyHours => {
  const w = {} as WeeklyHours;
  for (let d = 0; d < 7; d++) w[d] = spec[d] ?? closedDay();
  return w;
};

export const getDayHours = (wh: WeeklyHours, dow: number): DayHours => wh[dow] ?? closedDay();

export const validateDayHours = (d: DayHours): string | null => {
  if (d.closed) return null;
  if (timeToMin(d.end) <= timeToMin(d.start)) return 'O horário de fechamento deve ser depois da abertura.';
  if (d.hasBreak) {
    if (timeToMin(d.breakEnd) <= timeToMin(d.breakStart)) return 'O fim do intervalo deve ser depois do início.';
    if (timeToMin(d.breakStart) < timeToMin(d.start) || timeToMin(d.breakEnd) > timeToMin(d.end))
      return 'O intervalo deve estar dentro do horário de funcionamento.';
  }
  return null;
};

export const weekSummary = (wh: WeeklyHours): string => {
  const parts: string[] = [];
  let runStart = -1;
  let runKey = '';
  const flush = (i: number) => {
    if (runStart < 0) return;
    const dowEnd = DOW_ORDER[i - 1];
    const label = runStart === i - 1
      ? DOW_SHORT[DOW_ORDER[runStart]].replace('.', '')
      : `${DOW_SHORT[DOW_ORDER[runStart]].replace('.', '')}–${DOW_SHORT[dowEnd].replace('.', '')}`;
    parts.push(runKey === 'closed' ? `${cap(label)} fechado` : `${cap(label)} ${runKey}`);
    runStart = -1;
  };
  for (let i = 0; i < 7; i++) {
    const d = getDayHours(wh, DOW_ORDER[i]);
    const key = d.closed ? 'closed' : `${d.start}–${d.end}${d.hasBreak ? ` (int. ${d.breakStart}–${d.breakEnd})` : ''}`;
    if (key !== runKey) { flush(i); runStart = i; runKey = key; }
  }
  flush(7);
  return parts.join(' · ');
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const openLabelToday = (wh: WeeklyHours): string => {
  const d = getDayHours(wh, dowOf(todayISO()));
  return d.closed ? 'Fechado hoje' : `Hoje: ${d.start} – ${d.end}`;
};

/* ================= disponibilidade & conflitos ================= */

const BREAK_PAD = 0;

export function getSlots(o: {
  wh: WeeklyHours;
  dateISO: string;
  durationMin: number;
  professionalId: string;
  serviceId?: string;
  appointments: Appointment[];
  blocks: BlockedTime[];
  bufferBefore?: number;
  bufferAfter?: number;
  step?: number;
  excludePast?: boolean;
  maxPerDay?: number;
}): number[] {
  const dh = getDayHours(o.wh, dowOf(o.dateISO));
  if (dh.closed) return [];
  const open = timeToMin(dh.start);
  const close = timeToMin(dh.end);
  const step = o.step ?? 30;
  const excludePast = o.excludePast ?? true;

  const dayAppts = o.appointments.filter(
    (a) => a.date === o.dateISO && a.professionalId === o.professionalId && a.status !== 'cancelado' && a.status !== 'no_show',
  );
  if (o.maxPerDay && o.serviceId) {
    const count = dayAppts.filter((a) => a.serviceId === o.serviceId).length;
    if (count >= o.maxPerDay) return [];
  }
  const dayBlocks = o.blocks.filter(
    (b) => b.date === o.dateISO
      && (b.professionalId == null || b.professionalId === o.professionalId)
      && (b.serviceId == null || b.serviceId === o.serviceId),
  );

  const now = nowMinutes();
  const out: number[] = [];
  for (let s = open; s + o.durationMin <= close; s += step) {
    const e = s + o.durationMin;
    if (excludePast && o.dateISO === todayISO() && s < now) continue;
    if (dh.hasBreak && overlaps(s, e, timeToMin(dh.breakStart) - BREAK_PAD, timeToMin(dh.breakEnd) + BREAK_PAD)) continue;
    if (dayBlocks.some((b) => overlaps(s, e, b.startMin, b.endMin))) continue;
    const bb = o.bufferBefore ?? 0;
    const ba = o.bufferAfter ?? 0;
    if (dayAppts.some((a) => overlaps(s, e, a.startMin - bb, a.endMin + ba))) continue;
    out.push(s);
  }
  return out;
}

export function findConflict(o: {
  wh: WeeklyHours;
  dateISO: string;
  startMin: number;
  endMin: number;
  professionalId: string;
  serviceId: string;
  appointments: Appointment[];
  blocks: BlockedTime[];
  services: Service[];
  clients: Client[];
  bufferBefore?: number;
  bufferAfter?: number;
  ignoreId?: string;
}): string | null {
  const dh = getDayHours(o.wh, dowOf(o.dateISO));
  if (dh.closed) return 'O profissional não trabalha neste dia da semana.';
  const open = timeToMin(dh.start);
  const close = timeToMin(dh.end);
  if (o.startMin < open || o.endMin > close)
    return `Fora do horário de trabalho (${dh.start}–${dh.end}).`;
  if (dh.hasBreak && overlaps(o.startMin, o.endMin, timeToMin(dh.breakStart), timeToMin(dh.breakEnd)))
    return `Conflito com o intervalo de descanso (${dh.breakStart}–${dh.breakEnd}).`;

  const block = o.blocks.find(
    (b) => b.date === o.dateISO
      && (b.professionalId == null || b.professionalId === o.professionalId)
      && (b.serviceId == null || b.serviceId === o.serviceId)
      && overlaps(o.startMin, o.endMin, b.startMin, b.endMin),
  );
  if (block) return `Horário bloqueado: “${block.reason}” (${minToTime(block.startMin)}–${minToTime(block.endMin)}).`;

  const bb = o.bufferBefore ?? 0;
  const ba = o.bufferAfter ?? 0;
  const clash = o.appointments.find(
    (a) => a.id !== o.ignoreId
      && a.date === o.dateISO
      && a.professionalId === o.professionalId
      && a.status !== 'cancelado' && a.status !== 'no_show'
      && overlaps(o.startMin, o.endMin, a.startMin - bb, a.endMin + ba),
  );
  if (clash) {
    const svc = o.services.find((s) => s.id === clash.serviceId);
    const cli = o.clients.find((c) => c.id === clash.clientId);
    return `Conflito com ${svc?.name ?? 'atendimento'} de ${cli?.name ?? 'cliente'} (${minToTime(clash.startMin)}–${minToTime(clash.endMin)}).`;
  }
  return null;
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export const TEMPLATE_VARS = ['cliente', 'servico', 'profissional', 'data', 'hora', 'estabelecimento'];
