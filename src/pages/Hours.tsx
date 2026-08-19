import { useMemo, useState } from 'react';
import { useApp } from '../store';
import {
  DOW_SHORT, addDaysISO, dowOf, fmtShort, getDayHours, getSlots, nextDays, todayISO,
} from '../lib/schedule';
import { Avatar, Btn, Confirm, Dot, Icon, PageHead, useToast } from '../components/ui';
import { WorkingHoursEditor } from '../components/WorkingHoursEditor';

export function HoursPage() {
  const { data, mutate, nav } = useApp();
  const { push } = useToast();
  const [selId, setSelId] = useState(data.professionals[0]?.id ?? '');
  const [applyAll, setApplyAll] = useState(false);

  const pro = data.professionals.find((p) => p.id === selId) ?? data.professionals[0];

  const setProHours = (wh: typeof data.settings.defaultHours) => {
    if (!pro) return;
    mutate((d) => ({ ...d, professionals: d.professionals.map((p) => (p.id === pro.id ? { ...p, weeklyHours: wh } : p)) }));
  };

  const preview = useMemo(() => {
    if (!pro) return [];
    return nextDays(todayISO(), 7).map((date) => {
      const dh = getDayHours(pro.weeklyHours, dowOf(date));
      const slots = dh.closed ? [] : getSlots({
        wh: pro.weeklyHours, dateISO: date, durationMin: 60, professionalId: pro.id,
        appointments: data.appointments, blocks: data.blocks,
      });
      return { date, dh, slots: slots.length };
    });
  }, [pro, data.appointments, data.blocks]);

  const maxSlots = Math.max(...preview.map((p) => p.slots), 1);

  return (
    <div>
      <PageHead title="Horário de funcionamento"
        desc="Edição por dia da semana, com intervalo de descanso. As alterações valem na hora para a agenda, a disponibilidade e o portal do cliente.">
        <Btn variant="outline" icon="ban" onClick={() => nav('blocks')}>Bloqueios & ausências</Btn>
      </PageHead>

      {/* aviso de impacto */}
      <div className="anim-fadeUp mb-5 flex items-start gap-2.5 rounded-xl border border-steel/25 bg-steelsoft px-4 py-3">
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-steel" />
        <p className="text-[12.5px] font-medium leading-relaxed text-[#2c4f6e]">
          A disponibilidade é calculada cruzando <strong>horário de trabalho × intervalo × agendamentos × bloqueios × buffers do serviço</strong>.
          Fechar um dia ou reduzir a janela remove os horários do portal imediatamente — agendamentos existentes são preservados.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* seletor de profissional */}
          <section className="anim-fadeUp rounded-xl border border-line bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[15.5px] font-bold text-ink">Horários por profissional</h2>
              {pro && (
                <div className="flex gap-2">
                  <Btn variant="outline" size="sm" icon="refresh" onClick={() => {
                    setProHours({ ...data.settings.defaultHours });
                    push(`Horário padrão da casa aplicado a ${pro.name}.`);
                  }}>Usar padrão da casa</Btn>
                  <Btn variant="soft" size="sm" icon="users" onClick={() => setApplyAll(true)}>Aplicar a toda a equipe</Btn>
                </div>
              )}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {data.professionals.map((p) => {
                const on = pro?.id === p.id;
                return (
                  <button key={p.id} onClick={() => setSelId(p.id)}
                    className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[13px] font-bold transition-all duration-150 ${on ? 'border-transparent text-white shadow-md' : 'border-line bg-white text-inksoft hover:border-inkfaint'}`}
                    style={on ? { background: p.color } : undefined}>
                    <Avatar name={p.name} url={p.avatarUrl} color={p.color} size={26} />
                    {p.name.split(' ')[0]}
                    {!p.active && <span className={`rounded px-1 text-[9.5px] uppercase ${on ? 'bg-white/25' : 'bg-paper text-inkfaint'}`}>inativo</span>}
                  </button>
                );
              })}
            </div>

            {pro ? (
              <WorkingHoursEditor key={pro.id} value={pro.weeklyHours} onChange={setProHours} accent={pro.color} />
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-paper/50 px-4 py-8 text-center text-[13px] font-medium text-inkfaint">
                Cadastre um profissional para definir horários.
              </p>
            )}
          </section>

          {/* padrão da casa */}
          <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.1s' }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mosssoft text-mossdark"><Icon name="clock" size={15} /></span>
              <h2 className="font-display text-[15.5px] font-bold text-ink">Horário padrão do estabelecimento</h2>
            </div>
            <p className="mb-4 text-[12.5px] text-inksoft">
              Usado como base para novos profissionais e exibido como referência no portal do cliente ({data.settings.slug}.agendou.app).
            </p>
            <WorkingHoursEditor
              value={data.settings.defaultHours}
              onChange={(wh) => mutate((d) => ({ ...d, settings: { ...d.settings, defaultHours: wh } }))}
            />
          </section>
        </div>

        {/* prévia ao vivo */}
        <aside className="space-y-4">
          <section className="anim-slideLeft rounded-xl border border-line bg-card p-5">
            <h3 className="mb-1 flex items-center gap-2 font-display text-[14.5px] font-bold text-ink">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-moss pulse-dot" />
              Prévia ao vivo · {pro?.name ?? '—'}
            </h3>
            <p className="mb-4 text-[12px] text-inksoft">Slots de 60 min disponíveis nos próximos 7 dias, já descontando agendamentos e bloqueios reais.</p>
            <ul className="space-y-2">
              {preview.map((day) => (
                <li key={day.date} className={`rounded-lg border px-3 py-2 transition-colors ${day.dh.closed ? 'border-dashed border-line bg-paper/60' : 'border-line bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold capitalize text-ink">
                      {DOW_SHORT[dowOf(day.date)]} {fmtShort(day.date)}
                      {day.date === todayISO() && <span className="ml-1.5 rounded bg-mosssoft px-1 py-px text-[9.5px] font-bold uppercase text-mossdark">hoje</span>}
                    </span>
                    {day.dh.closed ? (
                      <span className="text-[11.5px] font-bold uppercase tracking-wide text-inkfaint">fechado</span>
                    ) : (
                      <span className={`tnum text-[11.5px] font-bold ${day.slots === 0 ? 'text-danger' : 'text-mossdark'}`}>
                        {day.slots === 0 ? 'lotado' : `${day.slots} slots`}
                      </span>
                    )}
                  </div>
                  {!day.dh.closed && (
                    <>
                      <p className="tnum mt-0.5 text-[11px] font-medium text-inksoft">
                        {day.dh.start}–{day.dh.end}{day.dh.hasBreak ? ` · intervalo ${day.dh.breakStart}–${day.dh.breakEnd}` : ''}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(day.slots / maxSlots) * 100}%`, background: pro?.color ?? '#157f63' }} />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="anim-slideLeft rounded-xl border border-line bg-pine p-5 text-[#c8d6ce]" style={{ animationDelay: '.12s' }}>
            <h3 className="mb-2 flex items-center gap-2 font-display text-[14.5px] font-bold text-white">
              <Icon name="ban" size={15} className="text-mint" /> Exceções & ausências
            </h3>
            <p className="mb-3 text-[12.5px] leading-relaxed">
              Férias, consultas, feriados e manutenção usam <strong className="text-white">bloqueios</strong> — pontuais ou recorrentes — sem mexer no horário padrão.
            </p>
            <Btn variant="soft" size="sm" icon="chevR" onClick={() => nav('blocks')}>Abrir bloqueios</Btn>
          </section>

          <section className="anim-slideLeft rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.18s' }}>
            <h3 className="mb-2 flex items-center gap-2 font-display text-[14.5px] font-bold text-ink">
              <Icon name="info" size={15} className="text-steel" /> Regras aplicadas
            </h3>
            <ul className="space-y-1.5 text-[12.5px] font-medium text-inksoft">
              <li className="flex gap-2"><Dot color="#157f63" size={6} /> Agendamentos fora do expediente são rejeitados.</li>
              <li className="flex gap-2"><Dot color="#c07a17" size={6} /> Intervalo de descanso não aceita reservas.</li>
              <li className="flex gap-2"><Dot color="#3a678f" size={6} /> Buffers de limpeza separam atendimentos.</li>
              <li className="flex gap-2"><Dot color="#6e4b7e" size={6} /> Limite diário por serviço (ex.: coloração).</li>
            </ul>
          </section>
        </aside>
      </div>

      <Confirm open={applyAll} onClose={() => setApplyAll(false)} title="Aplicar a toda a equipe"
        confirmLabel="Aplicar a todos" danger={false}
        desc={`Copiar o horário atual de ${pro?.name ?? ''} para todos os ${data.professionals.length} profissionais? Os horários individuais serão substituídos.`}
        onConfirm={() => {
          if (!pro) return;
          mutate((d) => ({ ...d, professionals: d.professionals.map((p) => ({ ...p, weeklyHours: { ...pro.weeklyHours } })) }));
          push(`Horário de ${pro.name} aplicado a toda a equipe.`);
        }} />
    </div>
  );
}
