import { useState } from 'react';
import type { Professional } from '../types';
import { useApp } from '../store';
import { todayISO, uid, weekSummary } from '../lib/schedule';
import {
  Avatar, Btn, Confirm, Dot, Field, Icon, ImageUpload, Modal, PageHead, TextArea,
  TextInput, Toggle, useToast,
} from '../components/ui';
import { WorkingHoursEditor } from '../components/WorkingHoursEditor';

const PALETTE = ['#c25e7c', '#a34a6d', '#3e8e9e', '#c98a2d', '#7a9a4e', '#5b7db1', '#3a678f', '#6e4b7e', '#8a5a44', '#157f63'];

function ProModal({ initial, onClose }: { initial: Professional | null; onClose: () => void }) {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const [form, setForm] = useState<Professional>(initial ?? {
    id: uid(), name: '', occupation: '', bio: '', color: PALETTE[2], commission: 30,
    active: true, avatarUrl: null, weeklyHours: { ...data.settings.defaultHours },
  });
  const [svcIds, setSvcIds] = useState<string[]>(
    initial ? data.services.filter((s) => s.professionalIds.includes(initial.id)).map((s) => s.id) : [],
  );
  const [err, setErr] = useState('');

  const save = () => {
    if (form.name.trim().length < 2) { setErr('Informe o nome do profissional.'); return; }
    mutate((d) => {
      const exists = d.professionals.some((p) => p.id === form.id);
      const services = d.services.map((s) => {
        const has = s.professionalIds.includes(form.id);
        const should = svcIds.includes(s.id);
        if (has === should) return s;
        return { ...s, professionalIds: should ? [...s.professionalIds, form.id] : s.professionalIds.filter((x) => x !== form.id) };
      });
      return {
        ...d,
        services,
        professionals: exists
          ? d.professionals.map((p) => (p.id === form.id ? { ...form, name: form.name.trim() } : p))
          : [...d.professionals, { ...form, name: form.name.trim() }],
      };
    });
    push(initial ? 'Profissional atualizado.' : `“${form.name}” entrou para a equipe.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} w="max-w-2xl" title={initial ? 'Editar profissional' : 'Novo profissional'}
      subtitle="Horários de trabalho valem por dia da semana, com intervalo opcional."
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="check" onClick={save}>{initial ? 'Salvar' : 'Adicionar à equipe'}</Btn></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nome" req><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Ocupação"><TextInput value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="Ex.: Cabeleireira" /></Field>
        <Field label="Bio / apresentação" className="sm:col-span-2">
          <TextArea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Visível no portal do cliente" />
        </Field>
        <Field label="Comissão (%)" hint="sobre serviços">
          <TextInput type="number" min={0} max={100} value={form.commission} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) })} />
        </Field>
        <Field label="Cor na agenda">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={`Cor ${c}`}
                className={`h-7 w-7 rounded-lg transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </Field>
        <div className="sm:col-span-2"><ImageUpload label="Avatar (400×400 recomendado)" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} /></div>

        <div className="sm:col-span-2">
          <Field label="Serviços realizados" hint="marque os serviços que este profissional atende">
            <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded-lg border border-line bg-white p-2.5 sm:grid-cols-2">
              {data.services.map((s) => {
                const on = svcIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => setSvcIds(on ? svcIds.filter((x) => x !== s.id) : [...svcIds, s.id])}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] font-semibold transition-all ${on ? 'border-moss/40 bg-mosssoft text-mossdark' : 'border-line bg-card text-inksoft hover:border-inkfaint'}`}>
                    <span className="flex items-center gap-2 truncate"><Dot color={s.color} size={8} />{s.name}</span>
                    {on && <Icon name="check" size={14} />}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Horários de trabalho semanais" hint="salvos por profissional">
            <WorkingHoursEditor value={form.weeklyHours} onChange={(wh) => setForm({ ...form, weeklyHours: wh })} accent={form.color} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-line bg-paper/70 px-3.5 py-2.5 sm:col-span-2">
          <div>
            <p className="text-[13px] font-bold text-ink">Profissional ativo</p>
            <p className="text-[11.5px] text-inksoft">Inativos saem da agenda e do portal.</p>
          </div>
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
      </div>
      {err && <p className="anim-drawIn mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-danger"><Icon name="alert" size={13} />{err}</p>}
    </Modal>
  );
}

export function ProfessionalsPage() {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const [modal, setModal] = useState<{ open: boolean; pro: Professional | null }>({ open: false, pro: null });
  const [toDelete, setToDelete] = useState<Professional | null>(null);
  const today = todayISO();

  const futureCount = (id: string) =>
    data.appointments.filter((a) => a.professionalId === id && a.date >= today && (a.status === 'pendente' || a.status === 'confirmado')).length;

  return (
    <div>
      <PageHead title="Profissionais" desc="Equipe, cores da agenda, comissões e horários de trabalho individuais.">
        <Btn icon="plus" onClick={() => setModal({ open: true, pro: null })}>Novo profissional</Btn>
      </PageHead>

      <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.professionals.map((p) => {
          const svcCount = data.services.filter((s) => s.professionalIds.length === 0 || s.professionalIds.includes(p.id)).length;
          const fc = futureCount(p.id);
          return (
            <article key={p.id} className={`group relative overflow-hidden rounded-xl border border-line bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${!p.active ? 'opacity-60' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
              <div className="flex items-start gap-3.5">
                <Avatar name={p.name} url={p.avatarUrl} color={p.color} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[16px] font-bold text-ink">{p.name}</h3>
                    <Dot color={p.color} size={8} />
                  </div>
                  <p className="text-[12.5px] font-semibold text-inksoft">{p.occupation || '—'}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-inkfaint">{p.bio || 'Sem bio cadastrada.'}</p>
                </div>
                <Toggle checked={p.active} onChange={(v) => {
                  mutate((d) => ({ ...d, professionals: d.professionals.map((x) => (x.id === p.id ? { ...x, active: v } : x)) }));
                  push(`“${p.name}” ${v ? 'ativado(a)' : 'desativado(a)'}.`, 'info');
                }} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-paper/70 px-2 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-inkfaint">Comissão</dt>
                  <dd className="tnum font-display text-[14px] font-bold text-ink">{p.commission}%</dd>
                </div>
                <div className="rounded-lg bg-paper/70 px-2 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-inkfaint">Serviços</dt>
                  <dd className="tnum font-display text-[14px] font-bold text-ink">{svcCount}</dd>
                </div>
                <div className="rounded-lg bg-paper/70 px-2 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-inkfaint">Futuros</dt>
                  <dd className="tnum font-display text-[14px] font-bold text-ink">{fc}</dd>
                </div>
              </dl>

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] font-medium leading-relaxed text-inksoft">
                <Icon name="clock" size={13} className="mt-0.5 shrink-0 text-inkfaint" />
                {weekSummary(p.weeklyHours)}
              </p>

              <div className="mt-4 flex gap-2">
                <Btn variant="outline" size="sm" icon="edit" className="flex-1" onClick={() => setModal({ open: true, pro: p })}>Editar & horários</Btn>
                <Btn variant="dangerSoft" size="sm" icon="trash" onClick={() => setToDelete(p)} aria-label="Excluir" />
              </div>
            </article>
          );
        })}
      </div>

      {modal.open && <ProModal initial={modal.pro} onClose={() => setModal({ open: false, pro: null })} />}

      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} title="Remover profissional"
        desc={toDelete && futureCount(toDelete.id) > 0
          ? `“${toDelete.name}” tem ${futureCount(toDelete.id)} agendamento(s) futuros. Remover mesmo assim? Os agendamentos permanecem no histórico.`
          : `Remover “${toDelete?.name}” da equipe?`}
        onConfirm={() => {
          if (!toDelete) return;
          mutate((d) => ({ ...d, professionals: d.professionals.filter((p) => p.id !== toDelete.id) }));
          push('Profissional removido.');
        }} />
    </div>
  );
}
