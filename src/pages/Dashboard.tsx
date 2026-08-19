import { useMemo } from 'react';
import type { PaymentRecord } from '../types';
import { ACCESS } from '../types';
import { useApp } from '../store';
import {
  addDaysISO, dowOf, DOW_SHORT, fmtBRL, fmtShortDow, fmtDayLong,
  getDayHours, greeting, minToTime, monthKey, nextDays, timeToMin, todayISO,
} from '../lib/schedule';
import { Btn, Dot, EmptyState, Icon, StatusBadge, useToast } from '../components/ui';

function RevenueChart({ payments, accent }: { payments: PaymentRecord[]; accent: string }) {
  const days = nextDays(addDaysISO(todayISO(), -6), 7);
  const totals = days.map((d) => payments.filter((p) => p.date === d && p.status === 'pago').reduce((s, p) => s + p.amount, 0));
  const max = Math.max(...totals, 1);
  const total7 = totals.reduce((s, v) => s + v, 0);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[13px] font-semibold text-inksoft">Últimos 7 dias</p>
        <p className="font-display text-[15px] font-bold text-ink">{fmtBRL(total7)}</p>
      </div>
      <svg viewBox="0 0 560 176" className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="10" x2="550" y1={140 - f * 120} y2={140 - f * 120} stroke="#e6e8e0" strokeDasharray="3 4" />
        ))}
        {days.map((d, i) => {
          const v = totals[i];
          const h = Math.max(4, (v / max) * 120);
          const today = d === todayISO();
          return (
            <g key={d}>
              <rect x={22 + i * 76} y={140 - h} width="52" height={h} rx="7"
                fill={today ? accent : '#d5ddd1'} className="anim-bar" style={{ animationDelay: `${i * 0.05}s` }}>
                <title>{`${fmtShortDow(d)} — ${fmtBRL(v)}`}</title>
              </rect>
              <text x={48 + i * 76} y="158" textAnchor="middle" fontSize="11.5" fontWeight={today ? 800 : 600}
                fill={today ? '#1c2521' : '#8b958d'} fontFamily="Space Grotesk">
                {DOW_SHORT[dowOf(d)]}
              </text>
              {v > 0 && (
                <text x={48 + i * 76} y={134 - h} textAnchor="middle" fontSize="10.5" fontWeight={700} fill="#5c675f">
                  {Math.round(v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DashboardPage() {
  const { data, mutate, role, nav, setIntent, currentUser, setPortalOpen } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const stats = useMemo(() => {
    const active = data.appointments.filter((a) => a.status !== 'cancelado' && a.status !== 'no_show');
    const todayList = data.appointments.filter((a) => a.date === today && a.status !== 'cancelado');
    const weekStart = addDaysISO(today, -((new Date().getDay() + 6) % 7));
    const weekEnd = addDaysISO(weekStart, 6);
    const weekList = active.filter((a) => a.date >= weekStart && a.date <= weekEnd);
    const mk = monthKey(today);
    const revenueMonth = data.payments.filter((p) => monthKey(p.date) === mk && p.status === 'pago').reduce((s, p) => s + p.amount, 0);
    const paysMonth = data.payments.filter((p) => monthKey(p.date) === mk && p.status === 'pago').length;

    let capacity = 0;
    for (const p of data.professionals.filter((x) => x.active)) {
      for (let i = 0; i < 7; i++) {
        const date = addDaysISO(weekStart, i);
        const dh = getDayHours(p.weeklyHours, dowOf(date));
        if (!dh.closed) {
          let mins = timeToMin(dh.end) - timeToMin(dh.start);
          if (dh.hasBreak) mins -= timeToMin(dh.breakEnd) - timeToMin(dh.breakStart);
          capacity += mins;
        }
      }
    }
    const booked = weekList.filter((a) => a.status === 'confirmado' || a.status === 'concluido')
      .reduce((s, a) => s + (a.endMin - a.startMin), 0);
    const occupancy = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

    const byService = new Map<string, { count: number; revenue: number }>();
    for (const a of data.appointments.filter((x) => x.status === 'concluido' && monthKey(x.date) === mk)) {
      const cur = byService.get(a.serviceId) ?? { count: 0, revenue: 0 };
      byService.set(a.serviceId, { count: cur.count + 1, revenue: cur.revenue + a.price });
    }
    const topServices = [...byService.entries()].sort((x, y) => y[1].revenue - x[1].revenue).slice(0, 4);

    return { todayList, weekCount: weekList.length, revenueMonth, paysMonth, occupancy, booked, capacity, topServices };
  }, [data, today]);

  const todaySorted = [...stats.todayList].sort((a, b) => a.startMin - b.startMin || a.professionalId.localeCompare(b.professionalId));
  const upBlocks = data.blocks.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin).slice(0, 3);
  const canAgenda = ACCESS[role].includes('agenda');
  const maxTop = Math.max(...stats.topServices.map(([, v]) => v.revenue), 1);

  const quickStatus = (id: string, status: 'confirmado' | 'concluido') => {
    const appt = data.appointments.find((a) => a.id === id);
    if (!appt) return;
    mutate((d) => {
      const appointments = d.appointments.map((a) => (a.id === id ? { ...a, status } : a));
      let payments = d.payments;
      if (status === 'concluido' && appt.paymentMethodId && !d.payments.some((p) => p.appointmentId === id)) {
        payments = [...d.payments, { id: `pg-${id}`, appointmentId: id, methodId: appt.paymentMethodId, amount: appt.price, date: appt.date, status: 'pago' as const }];
      }
      return { ...d, appointments, payments };
    });
    push(status === 'confirmado' ? 'Agendamento confirmado — cliente notificado via WhatsApp (simulado).' : 'Atendimento concluído e registrado no financeiro.');
  };

  const kpis = [
    { label: 'Agendamentos hoje', value: String(stats.todayList.length), sub: `${stats.todayList.filter((a) => a.status === 'confirmado').length} confirmados`, icon: 'calendar', bg: '#e0efe8', fg: '#157f63' },
    { label: 'Esta semana', value: String(stats.weekCount), sub: `${Math.round(stats.booked / 60)}h reservadas`, icon: 'calendarBig', bg: '#e3ebf3', fg: '#3a678f' },
    { label: 'Faturamento do mês', value: fmtBRL(stats.revenueMonth), sub: `${stats.paysMonth} pagamentos recebidos`, icon: 'wallet', bg: '#f8ecd6', fg: '#c07a17' },
    { label: 'Ocupação da semana', value: `${stats.occupancy}%`, sub: `de ${Math.round(stats.capacity / 60)}h disponíveis`, icon: 'percent', bg: '#eee5f2', fg: '#6e4b7e' },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-inkfaint">{fmtDayLong(today)}</p>
          <h1 className="mt-0.5 font-display text-[24px] font-bold tracking-tight text-ink">
            {greeting()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-[13.5px] text-inksoft">
            {stats.todayList.length === 0
              ? 'Nenhum atendimento marcado para hoje — a agenda está livre.'
              : `${stats.todayList.length} atendimento(s) na agenda de hoje. ${stats.todayList.filter((a) => a.status === 'pendente').length} aguardando confirmação.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" icon="eye" onClick={() => setPortalOpen(true)}>Portal do cliente</Btn>
          {canAgenda && (
            <Btn icon="plus" onClick={() => { setIntent({ kind: 'new-appointment' }); nav('agenda'); }}>Novo agendamento</Btn>
          )}
        </div>
      </div>

      <div className="stagger mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="group rounded-xl border border-line bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wide text-inksoft">{k.label}</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110" style={{ background: k.bg, color: k.fg }}>
                <Icon name={k.icon} size={16} />
              </span>
            </div>
            <p className="tnum mt-2 font-display text-[26px] font-bold leading-none text-ink">{k.value}</p>
            <p className="mt-1.5 text-[12px] font-medium text-inkfaint">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.15s' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Faturamento diário</h2>
            <button onClick={() => nav('payments')} className="text-[12.5px] font-bold text-moss transition-colors hover:text-mossdark">ver pagamentos →</button>
          </div>
          <RevenueChart payments={data.payments} accent={data.settings.accent} />
        </section>

        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.22s' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Agenda de hoje</h2>
            {canAgenda && <button onClick={() => nav('agenda')} className="text-[12.5px] font-bold text-moss transition-colors hover:text-mossdark">abrir agenda →</button>}
          </div>
          {todaySorted.length === 0 ? (
            <EmptyState icon="calendar" title="Dia livre" desc="Nenhum agendamento para hoje. Que tal abrir o portal do cliente e divulgar seus horários?" />
          ) : (
            <ul className="dark-scroll -mr-2 max-h-[340px] space-y-2 overflow-y-auto pr-2">
              {todaySorted.map((a) => {
                const cli = data.clients.find((c) => c.id === a.clientId);
                const svc = data.services.find((s) => s.id === a.serviceId);
                const pro = data.professionals.find((p) => p.id === a.professionalId);
                return (
                  <li key={a.id} className="group flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5 transition-all hover:border-inkfaint/60 hover:shadow-sm">
                    <div className="tnum w-[74px] shrink-0 font-display text-[13px] font-bold text-ink">
                      {minToTime(a.startMin)}
                      <span className="block text-[10.5px] font-semibold text-inkfaint">até {minToTime(a.endMin)}</span>
                    </div>
                    <Dot color={pro?.color ?? '#888'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{cli?.name ?? 'Cliente'}</p>
                      <p className="truncate text-[11.5px] text-inksoft">{svc?.name} · {pro?.name}</p>
                    </div>
                    <StatusBadge status={a.status} />
                    {a.status === 'pendente' && (
                      <Btn size="sm" variant="soft" onClick={() => quickStatus(a.id, 'confirmado')}>Confirmar</Btn>
                    )}
                    {a.status === 'confirmado' && (
                      <Btn size="sm" variant="outline" onClick={() => quickStatus(a.id, 'concluido')}>Concluir</Btn>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.28s' }}>
          <h2 className="mb-3 font-display text-[15.5px] font-bold text-ink">Top serviços do mês</h2>
          {stats.topServices.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-inkfaint">Nenhum atendimento concluído neste mês ainda.</p>
          ) : (
            <ul className="space-y-3">
              {stats.topServices.map(([sid, v]) => {
                const svc = data.services.find((s) => s.id === sid);
                return (
                  <li key={sid}>
                    <div className="mb-1 flex items-baseline justify-between text-[13px]">
                      <span className="font-bold text-ink">{svc?.name ?? 'Serviço removido'} <span className="font-semibold text-inkfaint">· {v.count}x</span></span>
                      <span className="tnum font-display font-bold text-ink">{fmtBRL(v.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(v.revenue / maxTop) * 100}%`, background: svc?.color ?? '#157f63' }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.34s' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Próximos bloqueios</h2>
            {ACCESS[role].includes('blocks') && <button onClick={() => nav('blocks')} className="text-[12.5px] font-bold text-moss transition-colors hover:text-mossdark">gerenciar →</button>}
          </div>
          {upBlocks.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-inkfaint">Nenhum bloqueio futuro cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {upBlocks.map((b) => {
                const pro = b.professionalId ? data.professionals.find((p) => p.id === b.professionalId) : null;
                return (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-paper/60 px-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ambersoft text-amber"><Icon name="ban" size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{b.reason}</p>
                      <p className="text-[11.5px] text-inksoft">{fmtShortDow(b.date)} · {minToTime(b.startMin)}–{minToTime(b.endMin)} · {pro ? pro.name : 'Estabelecimento todo'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
