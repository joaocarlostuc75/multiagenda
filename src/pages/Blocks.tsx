import { useMemo, useState } from 'react';
import type { BlockedTime } from '../types';
import { useApp } from '../store';
import { addDaysISO, fmtDayLong, minToTime, overlaps, timeToMin, toISO, todayISO, uid } from '../lib/schedule';
import { Badge, Btn, Confirm, EmptyState, Field, Icon, Modal, PageHead, Select, TextInput, useToast } from '../components/ui';

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export function BlocksPage() {
  const { data, mutate, role, currentUser } = useApp();
  const { push } = useToast();
  const today = todayISO();
  const [modal, setModal] = useState(false);
  const [toDelete, setToDelete] = useState<{ block: BlockedTime; group: boolean } | null>(null);

  const canEdit = role === 'owner' || role === 'manager' || role === 'professional';

  const visible = useMemo(
    () => data.blocks.filter((b) => role !== 'professional' || b.professionalId == null || b.professionalId === currentUser.professionalId),
    [data.blocks, role, currentUser.professionalId],
  );
  const upcoming = useMemo(
    () => visible.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin),
    [visible, today],
  );
  const pastCount = visible.filter((b) => b.date < today).length;

  const grouped = useMemo(() => {
    const m = new Map<string, BlockedTime[]>();
    for (const b of upcoming) {
      const list = m.get(b.date) ?? [];
      list.push(b);
      m.set(b.date, list);
    }
    return [...m.entries()];
  }, [upcoming]);

  const scopeLabel = (b: BlockedTime) => {
    if (b.professionalId) return data.professionals.find((p) => p.id === b.professionalId)?.name ?? 'Profissional';
    if (b.serviceId) return `Serviço: ${data.services.find((s) => s.id === b.serviceId)?.name ?? '—'}`;
    return 'Estabelecimento todo';
  };

  const remove = (block: BlockedTime, group: boolean) => {
    mutate((d) => ({
      ...d,
      blocks: group && block.groupId
        ? d.blocks.filter((b) => b.groupId !== block.groupId)
        : d.blocks.filter((b) => b.id !== block.id),
    }));
    push(group ? 'Série recorrente removida.' : 'Bloqueio removido — horários liberados.');
  };

  return (
    <div>
      <PageHead title="Bloqueios de agenda" desc="Ausências, férias, feriados e manutenção. Bloqueios tornam o horário indisponível no portal.">
        {canEdit && <Btn icon="plus" onClick={() => setModal(true)}>Novo bloqueio</Btn>}
      </PageHead>

      {upcoming.length === 0 ? (
        <EmptyState icon="ban" title="Nenhum bloqueio futuro"
          desc="Quando um profissional precisar se ausentar ou a casa fechar para manutenção, registre aqui para proteger a agenda.">
          {canEdit && <Btn icon="plus" onClick={() => setModal(true)}>Criar bloqueio</Btn>}
        </EmptyState>
      ) : (
        <div className="stagger space-y-4">
          {grouped.map(([date, list]) => (
            <section key={date} className="overflow-hidden rounded-xl border border-line bg-card">
              <header className="flex items-center justify-between border-b border-line bg-paper/60 px-4 py-2.5">
                <h3 className="font-display text-[13.5px] font-bold capitalize text-ink">{fmtDayLong(date)}</h3>
                {date === today && <Badge tone="moss">hoje</Badge>}
              </header>
              <ul>
                {list.map((b) => {
                  const pro = b.professionalId ? data.professionals.find((p) => p.id === b.professionalId) : null;
                  const groupCount = b.groupId ? data.blocks.filter((x) => x.groupId === b.groupId && x.date >= today).length : 0;
                  return (
                    <li key={b.id} className="group flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-paper/50">
                      <span className="hatch flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-paper text-inksoft">
                        <Icon name="ban" size={17} />
                      </span>
                      <div className="tnum w-[110px] shrink-0 font-display text-[14px] font-bold text-ink">
                        {minToTime(b.startMin)}–{minToTime(b.endMin)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-ink">{b.reason}</p>
                        <p className="text-[12px] font-medium text-inksoft">
                          {scopeLabel(b)}
                          {groupCount > 1 && <span className="ml-1.5 font-bold text-plum">· repete {groupCount}x</span>}
                        </p>
                      </div>
                      {pro && <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-bold text-inksoft sm:flex"><span className="h-2 w-2 rounded-full" style={{ background: pro.color }} />{pro.name.split(' ')[0]}</span>}
                      {canEdit && (
                        <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {b.groupId && (
                            <button onClick={() => setToDelete({ block: b, group: true })}
                              className="rounded-md border border-line bg-white px-2 py-1.5 text-[11.5px] font-bold text-plum transition-colors hover:bg-plumsoft">
                              remover série
                            </button>
                          )}
                          <button onClick={() => setToDelete({ block: b, group: false })} className="rounded-md p-1.5 text-inksoft transition-colors hover:bg-dangersoft hover:text-danger" aria-label="Remover">
                            <Icon name="trash" size={15} />
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pastCount > 0 && (
        <p className="mt-4 text-center text-[12px] font-medium text-inkfaint">{pastCount} bloqueio(s) antigos arquivados automaticamente.</p>
      )}

      {modal && <BlockModal onClose={() => setModal(false)} />}

      <Confirm open={!!toDelete} onClose={() => setToDelete(null)}
        title={toDelete?.group ? 'Remover série recorrente' : 'Remover bloqueio'}
        desc={toDelete?.group
          ? `Remover todas as ocorrências de “${toDelete?.block.reason}”? Os horários voltarão a ficar disponíveis.`
          : `Remover “${toDelete?.block.reason}” (${toDelete ? minToTime(toDelete.block.startMin) : ''}–${toDelete ? minToTime(toDelete.block.endMin) : ''})?`}
        confirmLabel="Remover"
        onConfirm={() => { if (toDelete) remove(toDelete.block, toDelete.group); }} />
    </div>
  );
}

function BlockModal({ onClose }: { onClose: () => void }) {
  const { data, mutate, role, currentUser } = useApp();
  const { push } = useToast();
  const today = todayISO();
  const isProRole = role === 'professional';

  const [scope, setScope] = useState<'geral' | 'profissional' | 'servico'>('profissional');
  const [professionalId, setProfessionalId] = useState(
    isProRole ? (currentUser.professionalId ?? data.professionals[0]?.id ?? '') : (data.professionals.find((p) => p.active)?.id ?? ''),
  );
  const [serviceId, setServiceId] = useState(data.services.find((s) => s.active)?.id ?? '');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [reason, setReason] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [err, setErr] = useState('');

  const sMin = timeToMin(start);
  const eMin = timeToMin(end);

  const affectedAppts = useMemo(() => {
    const dates = occurrenceDates(date, recurrence);
    return data.appointments.filter((a) =>
      dates.includes(a.date)
      && a.status !== 'cancelado' && a.status !== 'no_show'
      && (scope !== 'profissional' || a.professionalId === professionalId)
      && overlaps(sMin, eMin, a.startMin, a.endMin),
    );
  }, [data.appointments, date, recurrence, scope, professionalId, sMin, eMin]);

  const save = () => {
    if (reason.trim().length < 2) { setErr('Descreva o motivo do bloqueio.'); return; }
    if (eMin <= sMin) { setErr('O fim deve ser depois do início.'); return; }
    const dates = occurrenceDates(date, recurrence);
    const gid = recurrence === 'none' ? null : uid();
    const newBlocks: BlockedTime[] = dates.map((d) => ({
      id: uid(), groupId: gid,
      professionalId: scope === 'profissional' ? professionalId : null,
      serviceId: scope === 'servico' ? serviceId : null,
      date: d, startMin: sMin, endMin: eMin, reason: reason.trim(),
    }));
    mutate((d) => ({ ...d, blocks: [...d.blocks, ...newBlocks] }));
    push(recurrence === 'none'
      ? 'Bloqueio criado — horário indisponível para reservas.'
      : `Bloqueio recorrente criado (${newBlocks.length} ocorrências).`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Novo bloqueio de agenda"
      subtitle="O período bloqueado some da disponibilidade do portal e da recepção."
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="ban" onClick={save}>Bloquear período</Btn></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {isProRole ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-steel/25 bg-steelsoft px-3.5 py-2.5 sm:col-span-2">
            <Icon name="user" size={16} className="shrink-0 text-steel" />
            <p className="text-[12.5px] font-semibold text-[#2c4f6e]">
              Você está bloqueando a própria agenda ({data.professionals.find((p) => p.id === professionalId)?.name ?? 'seu horário'}). Bloqueios gerais são restritos à gestão.
            </p>
          </div>
        ) : (
          <Field label="Abrangência" className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-1.5">
              {([['geral', 'Casa toda', 'ban'], ['profissional', 'Profissional', 'user'], ['servico', 'Serviço', 'scissors']] as const).map(([v, l, ic]) => (
                <button key={v} onClick={() => setScope(v)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[12px] font-bold transition-all ${scope === v ? 'border-moss/50 bg-mosssoft text-mossdark' : 'border-line bg-white text-inksoft hover:border-inkfaint'}`}>
                  <Icon name={ic} size={17} />{l}
                </button>
              ))}
            </div>
          </Field>
        )}
        {scope === 'profissional' && (
          <Field label="Profissional">
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              {data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        {scope === 'servico' && (
          <Field label="Serviço">
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Data inicial"><TextInput type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Início"><TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Fim"><TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Field label="Motivo" req><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Férias, feriado, manutenção…" /></Field>
        <Field label="Recorrência" className="sm:col-span-2">
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">Sem repetição (apenas esta data)</option>
            <option value="daily">Diária — próximos 4 dias</option>
            <option value="weekly">Semanal — próximas 4 semanas</option>
            <option value="monthly">Mensal — próximos 3 meses</option>
          </Select>
        </Field>
      </div>

      {affectedAppts.length > 0 && (
        <div className="anim-drawIn mt-4 flex items-start gap-2.5 rounded-lg border border-amber/30 bg-ambersoft px-3.5 py-3">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[12.5px] font-semibold text-[#7a5410]">
            Atenção: {affectedAppts.length} agendamento(s) já existentes ficam dentro deste período. Eles serão mantidos, mas nenhum novo poderá ser criado aqui.
          </p>
        </div>
      )}
      {err && <p className="anim-drawIn mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-danger"><Icon name="alert" size={13} />{err}</p>}
    </Modal>
  );
}

function occurrenceDates(startISO: string, r: Recurrence): string[] {
  if (r === 'daily') return [0, 1, 2, 3].map((n) => addDaysISO(startISO, n));
  if (r === 'weekly') return [0, 7, 14, 21].map((n) => addDaysISO(startISO, n));
  if (r === 'monthly') {
    return [0, 1, 2].map((m) => {
      const d = new Date(startISO + 'T12:00:00');
      d.setMonth(d.getMonth() + m);
      return toISO(d);
    });
  }
  return [startISO];
}
