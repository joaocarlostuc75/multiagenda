import { useEffect, useMemo, useState } from 'react';
import type { Appointment, Professional } from '../types';
import { useApp } from '../store';
import {
  DOW_SHORT, dowOf, fillTemplate, findConflict, fmtDayLong, fmtShort, getDayHours,
  getSlots, minToTime, nextDays, openLabelToday, todayISO, uid, weekSummary,
} from '../lib/schedule';
import { Avatar, Btn, Icon, TextInput, useToast } from '../components/ui';

type Slot = { startMin: number; proId: string };

export function PortalPage() {
  const { data, mutate, setPortalOpen } = useApp();
  const { push } = useToast();
  const s = data.settings;
  const today = todayISO();

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proChoice, setProChoice] = useState<string>('any');
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Appointment | null>(null);

  const svc = data.services.find((x) => x.id === serviceId) ?? null;
  const eligiblePros = useMemo(
    () => data.professionals.filter((p) => p.active && (!svc || svc.professionalIds.length === 0 || svc.professionalIds.includes(p.id))),
    [data.professionals, svc],
  );
  const chosenPro = proChoice === 'any' ? null : eligiblePros.find((p) => p.id === proChoice) ?? null;

  const days = nextDays(today, 14);

  const dayClosed = (d: string) => {
    const pros = chosenPro ? [chosenPro] : eligiblePros;
    return pros.length === 0 || pros.every((p) => getDayHours(p.weeklyHours, dowOf(d)).closed);
  };

  /* slots simulando busca no servidor */
  useEffect(() => {
    if (step !== 3 || !svc) return;
    setLoading(true);
    setSlot(null);
    const t = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(t);
  }, [step, date, proChoice, svc]);

  const slots: Slot[] = useMemo(() => {
    if (!svc) return [];
    const pros = chosenPro ? [chosenPro] : eligiblePros;
    const map = new Map<number, string>();
    for (const p of pros) {
      for (const m of getSlots({
        wh: p.weeklyHours, dateISO: date, durationMin: svc.durationMin, professionalId: p.id,
        serviceId: svc.id, appointments: data.appointments, blocks: data.blocks,
        bufferBefore: svc.bufferBefore, bufferAfter: svc.bufferAfter,
        maxPerDay: svc.maxPerDay || undefined,
      })) {
        if (!map.has(m)) map.set(m, p.id);
      }
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([startMin, proId]) => ({ startMin, proId }));
  }, [svc, date, chosenPro, eligiblePros, data.appointments, data.blocks]);

  const confirm = () => {
    if (!svc || !slot) return;
    setErr('');
    if (name.trim().length < 2) { setErr('Informe seu nome completo.'); return; }
    if (phone.trim().length < 8) { setErr('Informe um WhatsApp válido com DDD.'); return; }
    if (!consent) { setErr('Para continuar, aceite o tratamento dos seus dados (LGPD).'); return; }

    setSaving(true);
    window.setTimeout(() => {
      const pro = data.professionals.find((p) => p.id === slot.proId)!;
      const conflict = findConflict({
        wh: pro.weeklyHours, dateISO: date, startMin: slot.startMin, endMin: slot.startMin + svc.durationMin,
        professionalId: pro.id, serviceId: svc.id,
        appointments: data.appointments, blocks: data.blocks,
        services: data.services, clients: data.clients,
        bufferBefore: svc.bufferBefore, bufferAfter: svc.bufferAfter,
      });
      if (conflict) {
        setSaving(false);
        setErr(`Este horário acabou de ficar indisponível: ${conflict}`);
        setStep(3);
        return;
      }

      const apptId = uid();
      let clientId = data.clients.find((c) => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))?.id ?? '';
      const appt: Appointment = {
        id: apptId, clientId, professionalId: pro.id, serviceId: svc.id, date,
        startMin: slot.startMin, endMin: slot.startMin + svc.durationMin,
        status: 'pendente', price: svc.price, paymentMethodId: null,
        notes: 'Agendado pelo portal online', origin: 'online', createdAt: new Date().toISOString(),
      };

      mutate((d) => {
        let clients = d.clients;
        if (!clientId) {
          clientId = uid();
          appt.clientId = clientId;
          clients = [...clients, { id: clientId, name: name.trim(), phone: phone.trim(), email: email.trim(), birthdate: '', notes: 'Veio do portal online', tags: ['novo'], createdAt: new Date().toISOString() }];
        }
        const msgVars = {
          cliente: name.trim().split(' ')[0], servico: svc.name, profissional: pro.name,
          data: fmtShort(date), hora: minToTime(slot.startMin), estabelecimento: s.name,
        };
        return {
          ...d,
          clients,
          appointments: [...d.appointments, appt],
          notifications: [
            { id: uid(), to: s.name, phone: s.phone, kind: 'novo_online' as const, message: `🔔 Novo agendamento online: ${svc.name} em ${fmtDayLong(date)} às ${minToTime(slot.startMin)} — ${name.trim()} (${phone.trim()}).`, status: 'enviada' as const, at: new Date().toISOString() },
            { id: uid(), to: name.trim(), phone: phone.trim(), kind: 'confirmacao' as const, message: fillTemplate(d.settings.templates.confirmacao, msgVars), status: 'enviada' as const, at: new Date().toISOString() },
            ...d.notifications,
          ],
        };
      });
      setSaving(false);
      setDone(appt);
      push('Agendamento registrado — confirmação enviada no WhatsApp (simulado).');
    }, 700);
  };

  const reset = () => {
    setStep(1); setServiceId(null); setProChoice('any'); setDate(today); setSlot(null);
    setName(''); setPhone(''); setEmail(''); setConsent(false); setErr(''); setDone(null);
  };

  const steps = ['Serviço', 'Profissional', 'Horário', 'Seus dados'];

  return (
    <div className="anim-fadeIn fixed inset-0 z-[70] flex flex-col bg-paper">
      {/* topo */}
      <header className="shrink-0 text-white" style={{ background: s.accent }}>
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-5">
          {s.logoUrl
            ? <img src={s.logoUrl} alt={s.name} className="h-14 w-14 rounded-2xl border-2 border-white/60 object-cover" />
            : <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white/60 bg-white/15 font-display text-[24px] font-bold">{s.name[0]}</span>}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-bold leading-tight">{s.name}</h1>
            <p className="truncate text-[12.5px] font-semibold text-white/85">{s.category} · {s.address}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-bold">
              <Icon name="clock" size={12} /> {openLabelToday(s.defaultHours)}
            </p>
          </div>
          <button onClick={() => setPortalOpen(false)}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-[12.5px] font-bold transition-colors hover:bg-white/25">
            <Icon name="arrowL" size={14} /> Painel
          </button>
        </div>
      </header>

      <main className="dark-scroll flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {done && svc ? (
            /* ======= sucesso ======= */
            <div className="anim-scaleIn rounded-2xl border border-line bg-card p-8 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: s.accent }}>
                <Icon name="check" size={30} />
              </span>
              <h2 className="font-display text-[22px] font-bold text-ink">Horário reservado!</h2>
              <p className="mt-1 text-[13.5px] text-inksoft">Enviamos a confirmação para o seu WhatsApp. Aguardamos você 💚</p>
              <div className="mx-auto mt-5 max-w-sm space-y-2 rounded-xl border border-line bg-paper/70 p-4 text-left">
                {[
                  ['Serviço', `${svc.name} · ${svc.durationMin} min`],
                  ['Profissional', data.professionals.find((p) => p.id === done.professionalId)?.name ?? '—'],
                  ['Quando', `${fmtDayLong(done.date)} · ${minToTime(done.startMin)}–${minToTime(done.endMin)}`],
                  ['Valor', `R$ ${done.price}`],
                  ['Status', 'Pendente de confirmação do estabelecimento'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 text-[13px]">
                    <span className="font-bold uppercase tracking-wide text-inkfaint">{k}</span>
                    <span className="text-right font-semibold capitalize text-ink">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-2">
                <Btn variant="outline" onClick={() => setPortalOpen(false)}>Voltar ao painel</Btn>
                <Btn onClick={reset} style={{ background: s.accent }}>Fazer outro agendamento</Btn>
              </div>
            </div>
          ) : (
            <>
              {/* stepper */}
              <ol className="mb-6 flex items-center gap-2">
                {steps.map((label, i) => {
                  const n = i + 1;
                  const active = step === n;
                  const passed = step > n;
                  return (
                    <li key={label} className="flex flex-1 items-center gap-2">
                      <button
                        onClick={() => { if (passed) setStep(n); }}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[12.5px] font-bold transition-all ${active ? 'text-white shadow-md' : passed ? 'bg-moss text-white' : 'bg-line text-inkfaint'}`}
                        style={active ? { background: s.accent } : undefined}>
                        {passed ? <Icon name="check" size={13} /> : n}
                      </button>
                      <span className={`hidden text-[12px] font-bold sm:block ${active ? 'text-ink' : 'text-inkfaint'}`}>{label}</span>
                      {n < 4 && <span className={`h-px flex-1 ${passed ? 'bg-moss' : 'bg-line'}`} />}
                    </li>
                  );
                })}
              </ol>

              {/* passo 1: serviço */}
              {step === 1 && (
                <div className="anim-fadeUp space-y-5">
                  {data.services.every((x) => !x.active) && (
                    <div className="rounded-xl border border-dashed border-line bg-card px-4 py-10 text-center">
                      <Icon name="scissors" size={22} className="mx-auto mb-2 text-inkfaint" />
                      <p className="text-[13.5px] font-bold text-ink">Nenhum serviço disponível no momento</p>
                      <p className="mt-0.5 text-[12px] text-inksoft">O estabelecimento ainda está montando o catálogo online. Tente novamente em breve.</p>
                    </div>
                  )}
                  {data.categories.map((cat) => {
                    const list = data.services.filter((x) => x.categoryId === cat.id && x.active);
                    if (!list.length) return null;
                    return (
                      <section key={cat.id}>
                        <h2 className="mb-2 font-display text-[16px] font-bold text-ink">{cat.name}</h2>
                        <p className="mb-2.5 text-[12px] text-inksoft">{cat.description}</p>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {list.map((x) => (
                            <button key={x.id} onClick={() => { setServiceId(x.id); setProChoice('any'); setSlot(null); setStep(2); }}
                              className="group flex items-center gap-3.5 rounded-xl border border-line bg-card p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white" style={{ background: x.color }}>
                                {x.imageUrl ? <img src={x.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="spark" size={17} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-bold text-ink">{x.name}</span>
                                <span className="block truncate text-[11.5px] text-inksoft">{x.description}</span>
                                <span className="tnum mt-0.5 block text-[12px] font-bold" style={{ color: s.accent }}>
                                  {x.durationMin} min · R$ {x.price}
                                </span>
                              </span>
                              <Icon name="chevR" size={16} className="text-inkfaint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {/* passo 2: profissional */}
              {step === 2 && svc && (
                <div className="anim-fadeUp space-y-3">
                  <BackLink onClick={() => setStep(1)} label={`Serviço: ${svc.name}`} />
                  <button onClick={() => { setProChoice('any'); setSlot(null); setStep(3); }}
                    className="flex w-full items-center gap-3.5 rounded-xl border-2 border-dashed border-line bg-card p-4 text-left transition-all hover:border-moss hover:shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mosssoft text-mossdark"><Icon name="spark" size={18} /></span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold text-ink">Sem preferência</span>
                      <span className="block text-[12px] text-inksoft">Encaixamos você com quem estiver livre primeiro.</span>
                    </span>
                    <Icon name="chevR" size={16} className="text-inkfaint" />
                  </button>
                  {eligiblePros.map((p) => (
                    <ProCard key={p.id} p={p} onPick={() => { setProChoice(p.id); setSlot(null); setStep(3); }} />
                  ))}
                  {eligiblePros.length === 0 && (
                    <p className="rounded-xl border border-dashed border-line bg-card px-4 py-8 text-center text-[13px] text-inkfaint">
                      Nenhum profissional disponível para este serviço no momento.
                    </p>
                  )}
                </div>
              )}

              {/* passo 3: horário */}
              {step === 3 && svc && (
                <div className="anim-fadeUp">
                  <BackLink onClick={() => setStep(2)} label={`Profissional: ${chosenPro ? chosenPro.name : 'sem preferência'}`} />
                  <h3 className="mb-2 mt-4 font-display text-[15px] font-bold text-ink">Escolha o dia</h3>
                  <div className="dark-scroll mb-5 flex gap-2 overflow-x-auto pb-1.5">
                    {days.map((d) => {
                      const closed = dayClosed(d);
                      const on = date === d;
                      return (
                        <button key={d} disabled={closed} onClick={() => setDate(d)}
                          className={`flex w-[74px] shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 transition-all ${on ? 'border-transparent text-white shadow-md' : closed ? 'cursor-not-allowed border-line bg-paper text-inkfaint opacity-50' : 'border-line bg-card text-ink hover:border-inkfaint'}`}
                          style={on ? { background: s.accent } : undefined}>
                          <span className="text-[10.5px] font-bold uppercase">{DOW_SHORT[dowOf(d)]}</span>
                          <span className="tnum font-display text-[17px] font-bold">{d.slice(8)}</span>
                          <span className={`text-[9.5px] font-bold uppercase ${closed ? 'text-inkfaint' : on ? 'text-white/80' : 'text-inkfaint'}`}>
                            {closed ? 'fechado' : fmtShort(d).slice(3)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <h3 className="mb-2 font-display text-[15px] font-bold text-ink">Horários disponíveis</h3>
                  {loading ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {Array.from({ length: 10 }).map((_, i) => <span key={i} className="skeleton h-11 rounded-lg" />)}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-card px-4 py-8 text-center">
                      <Icon name="calendar" size={22} className="mx-auto mb-2 text-inkfaint" />
                      <p className="text-[13.5px] font-bold text-ink">Sem horários livres neste dia</p>
                      <p className="mt-0.5 text-[12px] text-inksoft">Tente outro dia ou outro profissional.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {slots.map((sl) => {
                        const on = slot?.startMin === sl.startMin;
                        const p = data.professionals.find((x) => x.id === sl.proId);
                        return (
                          <button key={sl.startMin} onClick={() => setSlot(sl)}
                            className={`tnum rounded-lg border py-2.5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${on ? 'border-transparent text-white shadow-md' : 'border-line bg-card text-ink hover:border-inkfaint'}`}
                            style={on ? { background: s.accent } : undefined}>
                            <span className="block font-display text-[14.5px] font-bold">{minToTime(sl.startMin)}</span>
                            {!chosenPro && <span className={`block text-[9.5px] font-bold uppercase ${on ? 'text-white/80' : 'text-inkfaint'}`}>{p?.name.split(' ')[0]}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Btn disabled={!slot} onClick={() => setStep(4)} icon="chevR" style={slot ? { background: s.accent } : undefined}>
                      Continuar
                    </Btn>
                  </div>
                </div>
              )}

              {/* passo 4: dados */}
              {step === 4 && svc && slot && (
                <div className="anim-fadeUp grid gap-4 sm:grid-cols-[1fr_270px]">
                  <div className="rounded-xl border border-line bg-card p-5">
                    <BackLink onClick={() => setStep(3)} label={`Horário: ${fmtShort(date)} às ${minToTime(slot.startMin)}`} />
                    <h3 className="mb-4 mt-3 font-display text-[15px] font-bold text-ink">Seus dados para confirmação</h3>
                    <div className="space-y-3.5">
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Nome completo *</label>
                        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Como no documento" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">WhatsApp * <span className="font-normal text-inkfaint">(receberá a confirmação)</span></label>
                        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">E-mail <span className="font-normal text-inkfaint">(opcional)</span></label>
                        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-paper/70 px-3 py-2.5">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#157f63]" />
                        <span className="text-[12px] leading-relaxed text-inksoft">
                          Autorizo o uso dos meus dados para gestão deste agendamento e envio de lembretes, conforme a <strong className="text-ink">LGPD</strong>. Posso solicitar exclusão a qualquer momento.
                        </span>
                      </label>
                    </div>
                    {err && <p className="anim-drawIn mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-danger"><Icon name="alert" size={13} />{err}</p>}
                    <div className="mt-5 flex justify-end">
                      <Btn icon={saving ? 'clock' : 'check'} disabled={saving} onClick={confirm} style={{ background: s.accent }}>
                        {saving ? 'Reservando…' : 'Confirmar agendamento'}
                      </Btn>
                    </div>
                  </div>

                  <aside className="h-fit rounded-xl border border-line bg-card p-4">
                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-inkfaint">Resumo</h4>
                    <div className="space-y-2.5 text-[13px]">
                      <p className="font-bold text-ink">{svc.name}</p>
                      <p className="flex items-center gap-1.5 text-inksoft"><Icon name="user" size={13} />{chosenPro?.name ?? 'Primeiro disponível'}</p>
                      <p className="flex items-center gap-1.5 text-inksoft"><Icon name="calendar" size={13} /><span className="capitalize">{fmtDayLong(date)}</span></p>
                      <p className="flex items-center gap-1.5 text-inksoft"><Icon name="clock" size={13} /><span className="tnum">{minToTime(slot.startMin)} – {minToTime(slot.startMin + svc.durationMin)}</span></p>
                      <div className="border-t border-line pt-2.5">
                        <p className="flex items-baseline justify-between">
                          <span className="font-bold text-inksoft">Total</span>
                          <span className="tnum font-display text-[19px] font-bold" style={{ color: s.accent }}>R$ {svc.price}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-inkfaint">Pagamento no estabelecimento · {data.paymentMethods.filter((m) => m.active).map((m) => m.name).join(', ')}</p>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-line bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-inksoft">
            <Icon name="pin" size={12} /> {s.address}
          </p>
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-inksoft">
            <Icon name="phone" size={12} /> {s.phone}
          </p>
          <p className="text-[11px] font-bold text-inkfaint">
            <span className="text-moss">▮</span> powered by Agendou · {weekSummary(s.defaultHours)}
          </p>
        </div>
      </footer>
    </div>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mb-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-bold text-moss transition-colors hover:bg-mosssoft hover:text-mossdark">
      <Icon name="arrowL" size={13} /> <span className="truncate">{label}</span>
    </button>
  );
}

function ProCard({ p, onPick }: { p: Professional; onPick: () => void }) {
  return (
    <button onClick={onPick}
      className="group flex w-full items-center gap-3.5 rounded-xl border border-line bg-card p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <Avatar name={p.name} url={p.avatarUrl} color={p.color} size={46} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14px] font-bold text-ink">{p.name}
          <span className="rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: p.color }}>{p.occupation}</span>
        </span>
        <span className="mt-0.5 line-clamp-1 block text-[12px] text-inksoft">{p.bio}</span>
        <span className="mt-0.5 block text-[11px] font-semibold text-inkfaint">{weekSummary(p.weeklyHours)}</span>
      </span>
      <Icon name="chevR" size={16} className="text-inkfaint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}
