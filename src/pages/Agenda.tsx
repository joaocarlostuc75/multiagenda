import { useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment, AppointmentStatus, BlockedTime, Professional, TenantData } from '../types';
import { useApp } from '../store';
import {
  DOW_SHORT, dowOf, fillTemplate, findConflict, fmtDayLong, fmtShort, fmtShortDow,
  getSlots, minToTime, monthLabel, startOfWeekISO, timeToMin, todayISO, toISO, uid, weekDaysOf,
} from '../lib/schedule';
import {
  Btn, Confirm, Dot, Field, Icon, Modal, Select, STATUS_META, StatusBadge, TextArea, TextInput, useToast,
} from '../components/ui';

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const HOUR_H = 48;
const HOUR_H_WEEK = 38;
const TOTAL_H = ((DAY_END - DAY_START) / 60) * HOUR_H;
const TOTAL_H_WEEK = ((DAY_END - DAY_START) / 60) * HOUR_H_WEEK;
const HOUR_MARKS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

type ModalState =
  | { mode: 'create'; date: string; professionalId: string; startMin: number | null }
  | { mode: 'edit'; appt: Appointment }
  | null;

type EnrichedAppt = Appointment & { clientName: string; serviceName: string };

/* ---------- util: notificação WhatsApp simulada ---------- */
function pushWhats(d: TenantData, kind: 'confirmacao' | 'cancelamento', appt: Appointment, clientName: string, phone: string): TenantData {
  const svc = d.services.find((s) => s.id === appt.serviceId);
  const pro = d.professionals.find((p) => p.id === appt.professionalId);
  const message = fillTemplate(d.settings.templates[kind], {
    cliente: clientName,
    servico: svc?.name ?? 'seu atendimento',
    profissional: pro?.name ?? 'nossa equipe',
    data: fmtShortDow(appt.date),
    hora: minToTime(appt.startMin),
    estabelecimento: d.settings.name,
  });
  return {
    ...d,
    notifications: [
      { id: uid(), to: clientName, phone, kind, message, status: 'enviada' as const, at: new Date().toISOString() },
      ...d.notifications,
    ],
  };
}

/* ================= coluna do dia ================= */

function DayColumn({ pro, date, appts, blocks, hourH, totalH, compact, nowMin, dragDelta, onSlotClick, onApptClick, onDragStart, canDrag }: {
  pro: Professional;
  date: string;
  appts: EnrichedAppt[];
  blocks: BlockedTime[];
  hourH: number;
  totalH: number;
  compact?: boolean;
  nowMin: number | null;
  dragDelta: { id: string; delta: number } | null;
  onSlotClick: (startMin: number) => void;
  onApptClick: (a: Appointment) => void;
  onDragStart?: (e: React.MouseEvent, a: Appointment) => void;
  canDrag: (a: Appointment) => boolean;
}) {
  const colBlocks = blocks.filter((b) => b.date === date && (b.professionalId == null || b.professionalId === pro.id));

  return (
    <div
      className="relative cursor-copy border-l border-line transition-colors hover:bg-mosssoft/25"
      style={{ height: totalH }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const min = DAY_START + Math.floor(((e.clientY - rect.top) / hourH) * 60 / 30) * 30;
        onSlotClick(Math.min(Math.max(min, DAY_START), DAY_END - 30));
      }}
    >
      {HOUR_MARKS.slice(1).map((h) => (
        <div key={h} className="hourline pointer-events-none absolute inset-x-0" style={{ top: ((h - DAY_START) / 60) * hourH }} />
      ))}

      {colBlocks.map((b) => {
        const top = ((b.startMin - DAY_START) / 60) * hourH;
        const h = Math.max(18, ((b.endMin - b.startMin) / 60) * hourH - 2);
        return (
          <div key={b.id} className="hatch pointer-events-none absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-ink/20 bg-paper/90 px-1.5 py-1"
            style={{ top: top + 1, height: h }}>
            <p className="flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-wide text-inksoft">
              <Icon name="ban" size={10} /> {b.reason}
            </p>
            {!compact && <p className="tnum text-[10px] font-semibold text-inkfaint">{minToTime(b.startMin)}–{minToTime(b.endMin)}{b.professionalId == null ? ' · geral' : ''}</p>}
          </div>
        );
      })}

      {appts.map((a) => {
        const meta = STATUS_META[a.status];
        const top = ((a.startMin - DAY_START) / 60) * hourH;
        const h = Math.max(24, ((a.endMin - a.startMin) / 60) * hourH - 4);
        const dragging = dragDelta?.id === a.id;
        const shift = dragging ? (dragDelta.delta / 60) * hourH : 0;
        return (
          <div key={a.id}
            role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onApptClick(a); }}
            onKeyDown={(e) => { if (e.key === 'Enter') onApptClick(a); }}
            onMouseDown={(e) => { if (canDrag(a) && onDragStart) { e.stopPropagation(); onDragStart(e, a); } }}
            className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-[3.5px] px-2 py-1 shadow-sm transition-[box-shadow,opacity] duration-150 hover:shadow-md ${meta.blockCls} ${dragging ? 'z-30 opacity-90 shadow-xl ring-2 ring-moss/40' : 'z-10'} ${canDrag(a) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            style={{ top: top + 2 + shift, height: h }}>
            <p className={`tnum text-[10.5px] font-bold ${compact ? 'leading-tight' : ''}`}>
              {minToTime(a.startMin)}–{minToTime(a.endMin)}
              {a.origin === 'online' && <span className="ml-1 rounded bg-white/60 px-1 text-[9px] font-bold uppercase text-ink/70">online</span>}
            </p>
            {h >= 34 && <p className="truncate text-[11.5px] font-bold leading-tight">{a.clientName ?? ''}</p>}
            {h >= 48 && !compact && <p className="truncate text-[10.5px] font-medium opacity-75">{a.serviceName ?? ''}</p>}
          </div>
        );
      })}

      {nowMin != null && nowMin >= DAY_START && nowMin <= DAY_END && (
        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: ((nowMin - DAY_START) / 60) * hourH }}>
          <div className="h-[2px] bg-danger" />
          <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-danger" />
        </div>
      )}
    </div>
  );
}

/* ================= página ================= */

export function AgendaPage() {
  const { data, mutate, role, currentUser, intent, setIntent } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [date, setDate] = useState(today);
  const [profFilter, setProfFilter] = useState<Set<string>>(() => new Set(data.professionals.filter((p) => p.active).map((p) => p.id)));
  const [weekPro, setWeekPro] = useState<string>(
    role === 'professional' && currentUser.professionalId ? currentUser.professionalId : (data.professionals.find((p) => p.active)?.id ?? ''),
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  const [dragDelta, setDragDelta] = useState<{ id: string; delta: number } | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const suppressClick = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (intent?.kind === 'new-appointment') {
      setIntent(null);
      const firstPro = data.professionals.find((p) => p.active);
      if (firstPro) setModal({ mode: 'create', date: today, professionalId: firstPro.id, startMin: null });
    }
  }, [intent]); // eslint-disable-line react-hooks/exhaustive-deps

  const isProRole = role === 'professional';
  const visiblePros = isProRole
    ? data.professionals.filter((p) => p.id === currentUser.professionalId)
    : data.professionals.filter((p) => p.active && profFilter.has(p.id));

  const canDrag = (a: Appointment) =>
    (a.status === 'pendente' || a.status === 'confirmado') && (!isProRole || a.professionalId === currentUser.professionalId);

  const startDrag = (e: React.MouseEvent, a: Appointment) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    let delta = 0;
    const move = (ev: MouseEvent) => {
      const d = Math.round((ev.clientY - startY) / (HOUR_H / 60) / 30) * 30;
      if (d !== delta) { delta = d; setDragDelta({ id: a.id, delta }); }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setDragDelta(null);
      if (delta !== 0) {
        suppressClick.current = true;
        commitMove(a, delta);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const commitMove = (a: Appointment, delta: number) => {
    const d = dataRef.current;
    const pro = d.professionals.find((p) => p.id === a.professionalId);
    const svc = d.services.find((s) => s.id === a.serviceId);
    if (!pro) return;
    const newStart = a.startMin + delta;
    const newEnd = a.endMin + delta;
    const conflict = findConflict({
      wh: pro.weeklyHours, dateISO: a.date, startMin: newStart, endMin: newEnd,
      professionalId: a.professionalId, serviceId: a.serviceId,
      appointments: d.appointments, blocks: d.blocks, services: d.services, clients: d.clients,
      bufferBefore: svc?.bufferBefore, bufferAfter: svc?.bufferAfter, ignoreId: a.id,
    });
    if (conflict) { push(`Não foi possível mover: ${conflict}`, 'err'); return; }
    mutate((cur) => ({
      ...cur,
      appointments: cur.appointments.map((x) => (x.id === a.id ? { ...x, startMin: newStart, endMin: newEnd } : x)),
    }));
    push(`Horário alterado para ${minToTime(newStart)}–${minToTime(newEnd)}.`);
  };

  const step = (dir: 1 | -1) => {
    if (view === 'month') {
      const [y, m] = date.split('-').map(Number);
      setDate(toISO(new Date(y, m - 1 + dir, 1)));
    } else {
      const base = new Date(date + 'T12:00:00');
      base.setDate(base.getDate() + dir * (view === 'week' ? 7 : 1));
      setDate(toISO(base));
    }
  };

  const headerLabel = view === 'day'
    ? fmtDayLong(date)
    : view === 'week'
      ? `${fmtShort(startOfWeekISO(date))} – ${fmtShort(weekDaysOf(date)[6])}`
      : monthLabel(date);

  /* dados enriquecidos p/ exibição */
  const enriched = useMemo(() => {
    const cm = new Map(data.clients.map((c) => [c.id, c.name]));
    const sm = new Map(data.services.map((s) => [s.id, s.name]));
    return data.appointments.map((a) => ({ ...a, clientName: cm.get(a.clientId) ?? 'Cliente', serviceName: sm.get(a.serviceId) ?? 'Serviço' }));
  }, [data.appointments, data.clients, data.services]);

  const apptsOf = (proId: string, d: string) => enriched.filter((a) => a.professionalId === proId && a.date === d);

  const togglePro = (id: string) => {
    setProfFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      return next;
    });
  };

  const weekDays = weekDaysOf(date);
  const monthStart = `${date.slice(0, 8)}01`;
  const monthWeeks = useMemo(() => {
    const first = startOfWeekISO(monthStart);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => {
      const base = new Date(first + 'T12:00:00');
      base.setDate(base.getDate() + w * 7 + i);
      return toISO(base);
    }));
  }, [monthStart]);

  const gridCols = `56px repeat(${Math.max(visiblePros.length, 1)}, 1fr)`;

  return (
    <div>
      {/* controles */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center rounded-lg border border-line bg-card">
          <button onClick={() => step(-1)} className="p-2 text-inksoft transition-colors hover:text-ink" aria-label="Anterior"><Icon name="chevL" size={16} /></button>
          <button onClick={() => setDate(today)} className="border-x border-line px-3 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-paper">Hoje</button>
          <button onClick={() => step(1)} className="p-2 text-inksoft transition-colors hover:text-ink" aria-label="Próximo"><Icon name="chevR" size={16} /></button>
        </div>
        <h2 className="font-display text-[16px] font-bold capitalize text-ink">{headerLabel}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line bg-paper p-0.5">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-[7px] px-3 py-1.5 text-[13px] font-bold transition-all ${view === v ? 'bg-pine text-white shadow-sm' : 'text-inksoft hover:text-ink'}`}>
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <Btn icon="plus" onClick={() => setModal({ mode: 'create', date, professionalId: visiblePros[0]?.id ?? weekPro, startMin: null })}>
            Novo agendamento
          </Btn>
        </div>
      </div>

      {/* filtros + legenda */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!isProRole && view !== 'week' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {data.professionals.filter((p) => p.active).map((p) => {
              const on = profFilter.has(p.id);
              return (
                <button key={p.id} onClick={() => togglePro(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold transition-all ${on ? 'border-transparent text-white shadow-sm' : 'border-line bg-card text-inksoft hover:border-inkfaint'}`}
                  style={on ? { background: p.color } : undefined}>
                  <Dot color={on ? '#ffffffcc' : p.color} size={7} />
                  {p.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}
        {view === 'week' && (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-inksoft">Profissional:</span>
            <Select value={weekPro} onChange={(e) => setWeekPro(e.target.value)} className="!w-auto !py-1.5" disabled={isProRole}>
              {data.professionals.filter((p) => p.active || p.id === weekPro).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          {(Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-inksoft">
              <Dot color={STATUS_META[s].dot} size={7} /> {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* ================= visão dia ================= */}
      {view === 'day' && (
        <div className="anim-fadeIn overflow-x-auto rounded-xl border border-line bg-card shadow-sm">
          <div className="min-w-[760px]">
            <div className="grid border-b border-line bg-paper/60" style={{ gridTemplateColumns: gridCols }}>
              <div className="px-2 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">hora</div>
              {visiblePros.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border-l border-line px-3 py-2">
                  <Dot color={p.color} size={9} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold leading-tight text-ink">{p.name}</p>
                    <p className="truncate text-[10.5px] font-medium text-inkfaint">{p.occupation}</p>
                  </div>
                </div>
              ))}
              {visiblePros.length === 0 && <div className="border-l border-line px-3 py-2 text-[13px] font-semibold text-inkfaint">Nenhum profissional selecionado</div>}
            </div>
            <div className="grid" style={{ gridTemplateColumns: gridCols }}>
              <div className="relative" style={{ height: TOTAL_H }}>
                {HOUR_MARKS.map((h) => (
                  <span key={h} className="tnum absolute right-2 text-[10.5px] font-bold text-inkfaint" style={{ top: ((h - DAY_START) / 60) * HOUR_H - 7 }}>
                    {minToTime(h)}
                  </span>
                ))}
              </div>
              {visiblePros.map((p) => (
                <DayColumn key={p.id} pro={p} date={date} appts={apptsOf(p.id, date)} blocks={data.blocks}
                  hourH={HOUR_H} totalH={TOTAL_H} nowMin={date === today ? nowMin : null} dragDelta={dragDelta}
                  canDrag={canDrag} onDragStart={startDrag}
                  onSlotClick={(m) => setModal({ mode: 'create', date, professionalId: p.id, startMin: m })}
                  onApptClick={(a) => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    setModal({ mode: 'edit', appt: a });
                  }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= visão semana ================= */}
      {view === 'week' && (
        <div className="anim-fadeIn overflow-x-auto rounded-xl border border-line bg-card shadow-sm">
          <div className="min-w-[860px]">
            <div className="grid border-b border-line bg-paper/60" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
              <div />
              {weekDays.map((d) => (
                <button key={d} onClick={() => { setDate(d); setView('day'); }}
                  className={`border-l border-line px-2 py-2 text-center transition-colors hover:bg-mosssoft/50 ${d === today ? 'bg-mosssoft/70' : ''}`}>
                  <p className={`text-[10.5px] font-bold uppercase tracking-wide ${d === today ? 'text-mossdark' : 'text-inkfaint'}`}>{DOW_SHORT[dowOf(d)]}</p>
                  <p className={`font-display text-[16px] font-bold ${d === today ? 'text-mossdark' : 'text-ink'}`}>{d.slice(8)}</p>
                </button>
              ))}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
              <div className="relative" style={{ height: TOTAL_H_WEEK }}>
                {HOUR_MARKS.filter((_, i) => i % 2 === 0).map((h) => (
                  <span key={h} className="tnum absolute right-2 text-[10px] font-bold text-inkfaint" style={{ top: ((h - DAY_START) / 60) * HOUR_H_WEEK - 7 }}>
                    {minToTime(h)}
                  </span>
                ))}
              </div>
              {weekDays.map((d) => {
                const pro = data.professionals.find((p) => p.id === weekPro);
                if (!pro) return <div key={d} className="border-l border-line" style={{ height: TOTAL_H_WEEK }} />;
                return (
                  <DayColumn key={d} pro={pro} date={d} appts={apptsOf(pro.id, d)} blocks={data.blocks}
                    hourH={HOUR_H_WEEK} totalH={TOTAL_H_WEEK} compact nowMin={d === today ? nowMin : null} dragDelta={null}
                    canDrag={() => false}
                    onSlotClick={(m) => setModal({ mode: 'create', date: d, professionalId: pro.id, startMin: m })}
                    onApptClick={(a) => setModal({ mode: 'edit', appt: a })} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= visão mês ================= */}
      {view === 'month' && (
        <div className="anim-fadeIn overflow-hidden rounded-xl border border-line bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b border-line bg-paper/60">
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => (
              <div key={d} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-inkfaint">{d}</div>
            ))}
          </div>
          {monthWeeks.map((week, wi) => (
            <div key={wi} className={`grid grid-cols-7 ${wi > 0 ? 'border-t border-line' : ''}`}>
              {week.map((d) => {
                const inMonth = d.slice(5, 7) === date.slice(5, 7);
                const dayAppts = enriched.filter((a) => a.date === d && a.status !== 'cancelado' && a.status !== 'no_show' && (!isProRole || a.professionalId === currentUser.professionalId));
                const dayBlocks = data.blocks.filter((b) => b.date === d && (isProRole ? b.professionalId == null || b.professionalId === currentUser.professionalId : true));
                return (
                  <button key={d} onClick={() => { setDate(d); setView('day'); }}
                    className={`min-h-[108px] border-l border-line p-1.5 text-left align-top transition-colors first:border-l-0 hover:bg-mosssoft/30 ${inMonth ? 'bg-white' : 'bg-paper/50'}`}>
                    <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-display text-[12.5px] font-bold ${d === today ? 'text-white' : inMonth ? 'text-ink' : 'text-inkfaint'}`}
                      style={d === today ? { background: data.settings.accent } : undefined}>
                      {Number(d.slice(8))}
                    </span>
                    <span className="block space-y-0.5">
                      {dayAppts.slice(0, 3).map((a) => (
                        <span key={a.id} className="tnum flex items-center gap-1 truncate rounded px-1 py-px text-[10px] font-bold"
                          style={{ background: `${STATUS_META[a.status].dot}1c`, color: STATUS_META[a.status].dot }}>
                          {minToTime(a.startMin)} {a.clientName.split(' ')[0]}
                        </span>
                      ))}
                      {dayAppts.length > 3 && <span className="block px-1 text-[10px] font-bold text-inkfaint">+{dayAppts.length - 3} mais</span>}
                      {dayBlocks.length > 0 && (
                        <span className="flex items-center gap-1 px-1 text-[10px] font-bold text-amber"><Icon name="ban" size={10} />{dayBlocks.length} bloqueio(s)</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-inkfaint">
        <Icon name="info" size={13} />
        Clique em um horário vazio para agendar · arraste um cartão na visão diária para mover · {timeToMin('07:00') === DAY_START ? 'janela 07:00–21:00' : ''}
      </p>

      {modal && <ApptModal state={modal} onClose={() => setModal(null)} onDelete={(a) => setConfirmDelete(a)} />}

      <Confirm open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        title="Excluir agendamento"
        desc={`Excluir definitivamente o atendimento de ${confirmDelete ? (data.clients.find((c) => c.id === confirmDelete.clientId)?.name ?? 'cliente') : ''} em ${confirmDelete ? fmtShortDow(confirmDelete.date) : ''} às ${confirmDelete ? minToTime(confirmDelete.startMin) : ''}? Essa ação não pode ser desfeita.`}
        onConfirm={() => {
          if (!confirmDelete) return;
          mutate((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== confirmDelete.id) }));
          push('Agendamento excluído.');
        }} />
    </div>
  );
}

/* ================= modal de agendamento ================= */

function ApptModal({ state, onClose, onDelete }: { state: Exclude<ModalState, null>; onClose: () => void; onDelete: (a: Appointment) => void }) {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const editing = state.mode === 'edit' ? state.appt : null;
  const today = todayISO();

  const [clientId, setClientId] = useState(editing?.clientId ?? '');
  const [isNewClient, setIsNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? data.services.find((s) => s.active)?.id ?? '');
  const [professionalId, setProfessionalId] = useState(editing?.professionalId ?? (state.mode === 'create' ? state.professionalId : ''));
  const [dateVal, setDateVal] = useState(editing?.date ?? (state.mode === 'create' ? state.date : today));
  const [startMin, setStartMin] = useState<number | null>(editing?.startMin ?? (state.mode === 'create' ? state.startMin : null));
  const [status, setStatus] = useState<AppointmentStatus>(editing?.status ?? 'confirmado');
  const [price, setPrice] = useState(editing?.price ?? 0);
  const [paymentMethodId, setPaymentMethodId] = useState(editing?.paymentMethodId ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [touched, setTouched] = useState(false);

  const svc = data.services.find((s) => s.id === serviceId);
  const pro = data.professionals.find((p) => p.id === professionalId);

  const eligiblePros = data.professionals.filter((p) => p.active && (!svc || svc.professionalIds.length === 0 || svc.professionalIds.includes(p.id)));

  useEffect(() => {
    const s = data.services.find((x) => x.id === serviceId);
    if (s) setPrice(s.price);
    if (svc && !eligiblePros.some((p) => p.id === professionalId)) {
      setProfessionalId(eligiblePros[0]?.id ?? '');
    }
  }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const apptsForSlots = editing ? data.appointments.filter((a) => a.id !== editing.id) : data.appointments;

  const slots = useMemo(() => {
    if (!svc || !pro) return [];
    const base = getSlots({
      wh: pro.weeklyHours, dateISO: dateVal, durationMin: svc.durationMin,
      professionalId: pro.id, serviceId: svc.id,
      appointments: apptsForSlots, blocks: data.blocks,
      bufferBefore: svc.bufferBefore, bufferAfter: svc.bufferAfter,
      maxPerDay: svc.maxPerDay || undefined,
    });
    if (editing && editing.date === dateVal && !base.includes(editing.startMin)) base.push(editing.startMin);
    return base.sort((a, b) => a - b);
  }, [svc, pro, dateVal, apptsForSlots, data.blocks, editing]);

  const endMin = startMin != null && svc ? startMin + svc.durationMin : null;

  const conflict = useMemo(() => {
    if (!svc || !pro || startMin == null || endMin == null) return null;
    return findConflict({
      wh: pro.weeklyHours, dateISO: dateVal, startMin, endMin,
      professionalId: pro.id, serviceId: svc.id,
      appointments: apptsForSlots, blocks: data.blocks,
      services: data.services, clients: data.clients,
      bufferBefore: svc.bufferBefore, bufferAfter: svc.bufferAfter,
      ignoreId: editing?.id,
    });
  }, [svc, pro, startMin, endMin, dateVal, apptsForSlots, data.blocks, data.services, data.clients, editing]);

  const clientOk = editing ? true : isNewClient ? newName.trim().length >= 2 && newPhone.trim().length >= 8 : !!clientId;
  const valid = clientOk && svc && pro && startMin != null && !conflict;

  const save = () => {
    setTouched(true);
    if (!valid || !svc || !pro || startMin == null || endMin == null) return;

    if (editing) {
      const before = editing;
      mutate((d) => {
        let next: TenantData = {
          ...d,
          appointments: d.appointments.map((a) => (a.id === editing.id ? {
            ...a, clientId: editing.clientId, serviceId, professionalId, date: dateVal,
            startMin, endMin, status, price, paymentMethodId: paymentMethodId || null, notes,
          } : a)),
        };
        const cli = d.clients.find((c) => c.id === before.clientId);
        if (status === 'cancelado' && before.status !== 'cancelado' && cli) next = pushWhats(next, 'cancelamento', { ...before, date: dateVal, startMin }, cli.name, cli.phone);
        if (status === 'confirmado' && before.status === 'pendente' && cli) next = pushWhats(next, 'confirmacao', { ...before, date: dateVal, startMin }, cli.name, cli.phone);
        if (status === 'concluido' && paymentMethodId && !d.payments.some((p) => p.appointmentId === editing.id)) {
          next = { ...next, payments: [...next.payments, { id: uid(), appointmentId: editing.id, methodId: paymentMethodId, amount: price, date: dateVal, status: 'pago' as const }] };
        }
        return next;
      });
      push('Agendamento atualizado.');
    } else {
      const apptId = uid();
      let finalClientId = clientId;
      mutate((d) => {
        let clients = d.clients;
        if (isNewClient) {
          finalClientId = uid();
          clients = [...clients, { id: finalClientId, name: newName.trim(), phone: newPhone.trim(), email: '', birthdate: '', notes: '', tags: ['novo'], createdAt: new Date().toISOString() }];
        }
        const appt: Appointment = {
          id: apptId, clientId: finalClientId, professionalId, serviceId, date: dateVal,
          startMin, endMin, status, price, paymentMethodId: paymentMethodId || null,
          notes, origin: 'interno', createdAt: new Date().toISOString(),
        };
        let next: TenantData = { ...d, clients, appointments: [...d.appointments, appt] };
        const cliName = isNewClient ? newName.trim() : d.clients.find((c) => c.id === clientId)?.name ?? 'cliente';
        const cliPhone = isNewClient ? newPhone.trim() : d.clients.find((c) => c.id === clientId)?.phone ?? '';
        if (status === 'confirmado') next = pushWhats(next, 'confirmacao', appt, cliName, cliPhone);
        return next;
      });
      push(
        status === 'confirmado'
          ? `Agendamento criado — confirmação enviada via WhatsApp (simulado).`
          : 'Agendamento criado como pendente.',
      );
    }
    onClose();
  };

  const applyStatus = (s: AppointmentStatus) => {
    if (!editing) return;
    mutate((d) => {
      let next: TenantData = { ...d, appointments: d.appointments.map((a) => (a.id === editing.id ? { ...a, status: s } : a)) };
      const cli = d.clients.find((c) => c.id === editing.clientId);
      if (s === 'cancelado' && cli) next = pushWhats(next, 'cancelamento', editing, cli.name, cli.phone);
      if (s === 'confirmado' && cli) next = pushWhats(next, 'confirmacao', editing, cli.name, cli.phone);
      if (s === 'concluido' && editing.paymentMethodId && !d.payments.some((p) => p.appointmentId === editing.id)) {
        next = { ...next, payments: [...next.payments, { id: uid(), appointmentId: editing.id, methodId: editing.paymentMethodId, amount: editing.price, date: editing.date, status: 'pago' as const }] };
      }
      return next;
    });
    const msg: Record<AppointmentStatus, string> = {
      confirmado: 'Confirmado — cliente notificado no WhatsApp (simulado).',
      concluido: 'Concluído — pagamento registrado no financeiro.',
      cancelado: 'Cancelado — cliente notificado no WhatsApp (simulado).',
      no_show: 'Marcado como não comparecimento.',
      pendente: 'Movido para pendente.',
    };
    push(msg[s], s === 'cancelado' ? 'info' : 'ok');
    onClose();
  };

  const statusBtns: { s: AppointmentStatus; label: string; cls: string }[] = [
    { s: 'confirmado', label: 'Confirmar', cls: 'bg-moss text-white hover:bg-mossdark' },
    { s: 'concluido', label: 'Concluir', cls: 'bg-pine text-white hover:bg-pine2' },
    { s: 'cancelado', label: 'Cancelar', cls: 'bg-dangersoft text-danger hover:bg-[#f0d5cf]' },
    { s: 'no_show', label: 'Não compareceu', cls: 'bg-plumsoft text-plum hover:bg-[#e2d4e9]' },
  ];

  return (
    <Modal open onClose={onClose} w="max-w-2xl"
      title={editing ? 'Editar agendamento' : 'Novo agendamento'}
      subtitle={editing ? `${data.clients.find((c) => c.id === editing.clientId)?.name ?? ''} · criado via ${editing.origin === 'online' ? 'portal do cliente' : 'painel interno'}` : 'Valide disponibilidade em tempo real — conflitos são bloqueados automaticamente.'}
      footer={
        <>
          {editing && (
            <Btn variant="dangerSoft" icon="trash" className="mr-auto" onClick={() => { onClose(); onDelete(editing); }}>Excluir</Btn>
          )}
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn icon="check" onClick={save} disabled={touched && !valid}>
            {editing ? 'Salvar alterações' : 'Criar agendamento'}
          </Btn>
        </>
      }>

      {editing && (
        <div className="mb-4">
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-inksoft">Ações rápidas de status</p>
          <div className="flex flex-wrap gap-1.5">
            {statusBtns.map((b) => (
              <button key={b.s} onClick={() => applyStatus(b.s)} disabled={editing.status === b.s}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all active:scale-[.97] disabled:opacity-40 ${b.cls}`}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="mt-2"><StatusBadge status={editing.status} /></div>
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* cliente */}
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-inksoft">Cliente<span className="ml-0.5 text-danger">*</span></span>
            {!editing && (
              <button onClick={() => setIsNewClient((v) => !v)} className="text-[12px] font-bold text-moss hover:text-mossdark">
                {isNewClient ? '← escolher existente' : '+ cadastrar novo na hora'}
              </button>
            )}
          </div>
          {!isNewClient || editing ? (
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione o cliente…</option>
              {[...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </Select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <TextInput placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextInput placeholder="WhatsApp (com DDD)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          )}
          {touched && !clientOk && <p className="anim-drawIn mt-1 text-[12px] font-medium text-danger">Informe o cliente (nome e WhatsApp válidos).</p>}
        </div>

        <Field label="Serviço" req>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {data.categories.map((cat) => {
              const list = data.services.filter((s) => s.categoryId === cat.id && s.active);
              if (!list.length) return null;
              return (
                <optgroup key={cat.id} label={cat.name}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {s.durationMin}min · R$ {s.price}</option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </Field>

        <Field label="Profissional" req hint={svc && svc.professionalIds.length > 0 ? `${eligiblePros.length} habilitado(s)` : 'todos habilitados'}>
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Selecione…</option>
            {eligiblePros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>

        <Field label="Data" req>
          <TextInput type="date" value={dateVal} min={today} onChange={(e) => { setDateVal(e.target.value); setStartMin(null); }} />
        </Field>

        <Field label="Horário" req hint={svc && pro ? `${slots.length} horários livres` : undefined}>
          <Select value={startMin == null ? '' : String(startMin)} onChange={(e) => setStartMin(e.target.value ? Number(e.target.value) : null)}>
            <option value="">
              {!svc || !pro ? 'Escolha serviço e profissional…' : slots.length === 0 ? 'Sem horários disponíveis nesta data' : 'Selecione…'}
            </option>
            {slots.map((m) => (
              <option key={m} value={m}>{minToTime(m)} – {svc ? minToTime(m + svc.durationMin) : ''}</option>
            ))}
          </Select>
        </Field>

        <Field label={`Valor (R$)`} hint={svc ? `tabela: R$ ${svc.price}` : undefined}>
          <TextInput type="number" min={0} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>

        <Field label="Forma de pagamento" hint="opcional">
          <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            <option value="">Definir depois</option>
            {data.paymentMethods.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>

        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
            {(Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Notas internas" className="sm:col-span-2" hint="não aparecem para o cliente">
          <TextArea placeholder="Preferências, alergias, observações…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {/* feedback de conflito / sucesso */}
      {conflict ? (
        <div className="anim-drawIn mt-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-dangersoft px-3.5 py-3">
          <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-[13px] font-bold text-danger">Conflito detectado</p>
            <p className="text-[12.5px] font-medium text-[#8a3a2e]">{conflict}</p>
          </div>
        </div>
      ) : startMin != null && svc && pro ? (
        <div className="anim-drawIn mt-4 flex items-start gap-2.5 rounded-lg border border-moss/30 bg-mosssoft px-3.5 py-3">
          <Icon name="check" size={17} className="mt-0.5 shrink-0 text-mossdark" />
          <p className="text-[12.5px] font-semibold text-[#0d503d]">
            Disponível: {fmtShortDow(dateVal)} · {minToTime(startMin)}–{endMin != null ? minToTime(endMin) : ''} com {pro.name} ({svc.durationMin} min
            {svc.bufferAfter ? ` + ${svc.bufferAfter} min de buffer` : ''}).
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
