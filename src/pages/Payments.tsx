import { useMemo, useState } from 'react';
import type { PaymentMethod } from '../types';
import { useApp } from '../store';
import { fmtBRL, fmtShortDow, minToTime, monthKey, todayISO, uid } from '../lib/schedule';
import { Badge, Btn, Confirm, Dot, Field, Icon, Modal, PageHead, Select, TextInput, Toggle, useToast } from '../components/ui';

const TYPE_META: Record<PaymentMethod['type'], { label: string; icon: string }> = {
  dinheiro: { label: 'Dinheiro', icon: 'wallet' },
  pix: { label: 'Pix', icon: 'zap' },
  cartao: { label: 'Cartão', icon: 'wallet' },
  transferencia: { label: 'Transferência', icon: 'send' },
};

function MethodModal({ initial, onClose }: { initial: PaymentMethod | null; onClose: () => void }) {
  const { mutate } = useApp();
  const { push } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<PaymentMethod['type']>(initial?.type ?? 'pix');
  const [err, setErr] = useState('');

  const save = () => {
    if (name.trim().length < 2) { setErr('Informe o nome da forma de pagamento.'); return; }
    mutate((d) => {
      if (initial) return { ...d, paymentMethods: d.paymentMethods.map((m) => (m.id === initial.id ? { ...m, name: name.trim(), type } : m)) };
      return { ...d, paymentMethods: [...d.paymentMethods, { id: uid(), name: name.trim(), type, active: true }] };
    });
    push(initial ? 'Forma de pagamento atualizada.' : 'Forma de pagamento criada.');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="check" onClick={save}>Salvar</Btn></>}>
      <div className="space-y-3.5">
        <Field label="Nome" req><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pix, Dinheiro, Vale-presente…" /></Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as PaymentMethod['type'])}>
            {(Object.keys(TYPE_META) as PaymentMethod['type'][]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </Select>
        </Field>
      </div>
      {err && <p className="anim-drawIn mt-3 text-[12.5px] font-bold text-danger">{err}</p>}
    </Modal>
  );
}

export function PaymentsPage() {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const [methodModal, setMethodModal] = useState<{ open: boolean; m: PaymentMethod | null }>({ open: false, m: null });
  const [delMethod, setDelMethod] = useState<PaymentMethod | null>(null);
  const [filterMethod, setFilterMethod] = useState('all');

  const mk = monthKey(todayISO());

  const monthPaid = data.payments.filter((p) => monthKey(p.date) === mk && p.status === 'pago');
  const totalMonth = monthPaid.reduce((s, p) => s + p.amount, 0);
  const avgTicket = monthPaid.length ? totalMonth / monthPaid.length : 0;

  const receivable = useMemo(
    () => data.appointments
      .filter((a) => a.status === 'confirmado' && !data.payments.some((p) => p.appointmentId === a.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
      .slice(0, 8),
    [data.appointments, data.payments],
  );
  const receivableTotal = receivable.reduce((s, a) => s + a.price, 0);

  const byMethod = data.paymentMethods.map((m) => ({
    m,
    total: monthPaid.filter((p) => p.methodId === m.id).reduce((s, p) => s + p.amount, 0),
  })).sort((a, b) => b.total - a.total);
  const maxMethod = Math.max(...byMethod.map((x) => x.total), 1);

  const records = [...data.payments]
    .filter((p) => filterMethod === 'all' || p.methodId === filterMethod)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  const receive = (appointmentId: string, methodId: string) => {
    const appt = data.appointments.find((a) => a.id === appointmentId);
    if (!appt || !methodId) { push('Escolha a forma de pagamento antes de receber.', 'err'); return; }
    mutate((d) => ({
      ...d,
      payments: [...d.payments, { id: uid(), appointmentId, methodId, amount: appt.price, date: appt.date, status: 'pago' as const }],
    }));
    push(`Pagamento de ${fmtBRL(appt.price)} registrado.`);
  };

  const methodInUse = (id: string) => data.payments.some((p) => p.methodId === id);

  return (
    <div>
      <PageHead title="Pagamentos" desc="Recebimentos por forma de pagamento, registro no ato do atendimento e valores a receber." />

      {/* resumo */}
      <div className="stagger mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-inksoft">Recebido no mês</p>
          <p className="tnum mt-2 font-display text-[26px] font-bold text-mossdark">{fmtBRL(totalMonth)}</p>
          <p className="mt-1 text-[12px] font-medium text-inkfaint">{monthPaid.length} pagamentos</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-inksoft">A receber (confirmados)</p>
          <p className="tnum mt-2 font-display text-[26px] font-bold text-amber">{fmtBRL(receivableTotal)}</p>
          <p className="mt-1 text-[12px] font-medium text-inkfaint">{receivable.length} atendimento(s) sem pagamento</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-inksoft">Ticket médio</p>
          <p className="tnum mt-2 font-display text-[26px] font-bold text-ink">{fmtBRL(avgTicket)}</p>
          <p className="mt-1 text-[12px] font-medium text-inkfaint">média por pagamento no mês</p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* registros */}
        <section className="anim-fadeUp overflow-hidden rounded-xl border border-line bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="font-display text-[15px] font-bold text-ink">Registros de pagamento</h2>
            <Select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="!w-auto !py-1.5 text-[13px]">
              <option value="all">Todas as formas</option>
              {data.paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </header>
          {records.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-inkfaint">Nenhum pagamento registrado com este filtro.</p>
          ) : (
            <ul className="dark-scroll max-h-[440px] divide-y divide-line/70 overflow-y-auto">
              {records.map((p) => {
                const appt = data.appointments.find((a) => a.id === p.appointmentId);
                const cli = appt ? data.clients.find((c) => c.id === appt.clientId) : null;
                const svc = appt ? data.services.find((s) => s.id === appt.serviceId) : null;
                const m = data.paymentMethods.find((x) => x.id === p.methodId);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-paper/50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mosssoft text-mossdark">
                      <Icon name={m ? TYPE_META[m.type].icon : 'wallet'} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{cli?.name ?? 'Atendimento avulso'}</p>
                      <p className="truncate text-[11.5px] text-inksoft">
                        {svc?.name ?? '—'} · {fmtShortDow(p.date)}{appt ? ` ${minToTime(appt.startMin)}` : ''} · {m?.name ?? 'forma removida'}
                      </p>
                    </div>
                    <Badge tone={p.status === 'pago' ? 'moss' : 'amber'}>{p.status}</Badge>
                    <span className="tnum w-[92px] text-right font-display text-[14px] font-bold text-ink">{fmtBRL(p.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {/* por forma */}
          <section className="anim-slideLeft rounded-xl border border-line bg-card p-4">
            <h3 className="mb-3 font-display text-[14.5px] font-bold text-ink">Recebido por forma (mês)</h3>
            {byMethod.every((x) => x.total === 0) ? (
              <p className="py-4 text-center text-[12.5px] text-inkfaint">Sem recebimentos neste mês.</p>
            ) : (
              <ul className="space-y-2.5">
                {byMethod.filter((x) => x.total > 0).map(({ m, total }) => (
                  <li key={m.id}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-1.5 font-bold text-ink"><Icon name={TYPE_META[m.type].icon} size={13} className="text-inksoft" />{m.name}</span>
                      <span className="tnum font-display font-bold text-ink">{fmtBRL(total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-moss transition-all duration-700" style={{ width: `${(total / maxMethod) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* formas */}
          <section className="anim-slideLeft rounded-xl border border-line bg-card p-4" style={{ animationDelay: '.08s' }}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-[14.5px] font-bold text-ink">Formas de pagamento</h3>
              <Btn size="sm" variant="outline" icon="plus" onClick={() => setMethodModal({ open: true, m: null })}>Nova</Btn>
            </div>
            <ul className="space-y-1.5">
              {data.paymentMethods.map((m) => (
                <li key={m.id} className="group flex items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-2">
                  <Icon name={TYPE_META[m.type].icon} size={15} className={m.active ? 'text-mossdark' : 'text-inkfaint'} />
                  <span className={`flex-1 truncate text-[13px] font-bold ${m.active ? 'text-ink' : 'text-inkfaint line-through'}`}>{m.name}</span>
                  <Toggle checked={m.active} onChange={(v) => mutate((d) => ({ ...d, paymentMethods: d.paymentMethods.map((x) => (x.id === m.id ? { ...x, active: v } : x)) }))} />
                  <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => setMethodModal({ open: true, m })} className="rounded p-1 text-inksoft hover:text-ink" aria-label="Editar"><Icon name="edit" size={13} /></button>
                    <button onClick={() => (methodInUse(m.id) ? push('Forma em uso no histórico — desative em vez de excluir.', 'err') : setDelMethod(m))}
                      className="rounded p-1 text-inksoft hover:text-danger" aria-label="Excluir"><Icon name="trash" size={13} /></button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* a receber */}
      <section className="anim-fadeUp rounded-xl border border-line bg-card" style={{ animationDelay: '.12s' }}>
        <header className="border-b border-line px-4 py-3">
          <h2 className="font-display text-[15px] font-bold text-ink">Receber agora</h2>
          <p className="text-[12px] text-inksoft">Atendimentos confirmados ainda sem pagamento registrado.</p>
        </header>
        {receivable.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-inkfaint">Tudo certo — nenhum valor pendente nos próximos confirmados.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {receivable.map((a) => {
              const cli = data.clients.find((c) => c.id === a.clientId);
              const svc = data.services.find((s) => s.id === a.serviceId);
              return (
                <ReceiveRow key={a.id} label={`${cli?.name ?? 'Cliente'} · ${svc?.name ?? '—'}`}
                  sub={`${fmtShortDow(a.date)} ${minToTime(a.startMin)} · ${fmtBRL(a.price)}`}
                  methods={data.paymentMethods.filter((m) => m.active)}
                  onReceive={(methodId) => receive(a.id, methodId)} />
              );
            })}
          </ul>
        )}
      </section>

      {methodModal.open && <MethodModal initial={methodModal.m} onClose={() => setMethodModal({ open: false, m: null })} />}

      <Confirm open={!!delMethod} onClose={() => setDelMethod(null)} title="Excluir forma de pagamento"
        desc={`Excluir “${delMethod?.name}”?`}
        onConfirm={() => { if (delMethod) { mutate((d) => ({ ...d, paymentMethods: d.paymentMethods.filter((m) => m.id !== delMethod.id) })); push('Forma de pagamento excluída.'); } }} />
    </div>
  );
}

function ReceiveRow({ label, sub, methods, onReceive }: {
  label: string; sub: string; methods: PaymentMethod[]; onReceive: (methodId: string) => void;
}) {
  const [methodId, setMethodId] = useState(methods[1]?.id ?? methods[0]?.id ?? '');
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Dot color="#c07a17" size={8} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-ink">{label}</p>
        <p className="tnum text-[11.5px] font-medium text-inksoft">{sub}</p>
      </div>
      <Select value={methodId} onChange={(e) => setMethodId(e.target.value)} className="!w-40 !py-1.5 text-[12.5px]">
        {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
      <Btn size="sm" icon="check" onClick={() => onReceive(methodId)}>Receber</Btn>
    </li>
  );
}
