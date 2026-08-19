import { useMemo, useRef } from 'react';
import type { NotificationKind } from '../types';
import { useApp } from '../store';
import { TEMPLATE_VARS, fillTemplate, fmtShortDow, minToTime, todayISO, uid } from '../lib/schedule';
import { Badge, Btn, Icon, PageHead, Toggle, useToast, type Tone } from '../components/ui';

const KIND_META: Record<NotificationKind, { label: string; tone: Tone }> = {
  confirmacao: { label: 'Confirmação', tone: 'moss' },
  lembrete24: { label: 'Lembrete 24h', tone: 'steel' },
  lembrete2: { label: 'Lembrete 2h', tone: 'amber' },
  cancelamento: { label: 'Cancelamento', tone: 'danger' },
  novo_online: { label: 'Novo online', tone: 'plum' },
};

const TPL_FIELDS: { key: keyof ReturnType<typeof templatesOf>; label: string; desc: string }[] = [
  { key: 'confirmacao', label: 'Confirmação de agendamento', desc: 'Enviada ao confirmar (recepção ou portal).' },
  { key: 'lembrete24', label: 'Lembrete — 24h antes', desc: 'Disparo automático na véspera.' },
  { key: 'lembrete2', label: 'Lembrete — 2h antes', desc: 'Disparo automático no dia.' },
  { key: 'cancelamento', label: 'Cancelamento', desc: 'Enviada quando o horário é cancelado.' },
];

function templatesOf(t: { confirmacao: string; lembrete24: string; lembrete2: string; cancelamento: string }) {
  return t;
}

function TemplateCard({ fieldKey, label, desc, value, onChange, sample }: {
  fieldKey: string; label: string; desc: string; value: string;
  onChange: (v: string) => void; sample: Record<string, string>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (v: string) => {
    const el = ref.current;
    if (!el) { onChange(value + ` {{${v}}}`); return; }
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    onChange(value.slice(0, s) + `{{${v}}}` + value.slice(e));
    window.setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = s + v.length + 4; }, 0);
  };

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold text-ink">{label}</h3>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-moss">autosave</span>
      </div>
      <p className="mb-2.5 text-[11.5px] text-inksoft">{desc}</p>
      <textarea ref={ref} rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed text-ink placeholder:text-inkfaint focus:border-moss" />
      <div className="mt-2.5 flex flex-wrap gap-1">
        {TEMPLATE_VARS.map((v) => (
          <button key={v} onClick={() => insert(v)}
            className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] font-bold text-steel transition-all hover:border-steel hover:bg-steelsoft">
            {`{{${v}}}`}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-moss/20 bg-mosssoft/60 px-3 py-2.5">
        <p className="mb-1 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-mossdark">
          <Icon name="chat" size={11} /> Prévia com dados reais
        </p>
        <p className="text-[12px] font-medium leading-relaxed text-[#123b2f]">{fillTemplate(value, sample)}</p>
      </div>
      <span className="hidden">{fieldKey}</span>
    </div>
  );
}

export function NotificationsPage() {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const sample = useMemo(() => {
    const next = data.appointments
      .filter((a) => a.date >= today && a.status !== 'cancelado')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)[0];
    const cli = next ? data.clients.find((c) => c.id === next.clientId) : null;
    const svc = next ? data.services.find((s) => s.id === next.serviceId) : null;
    const pro = next ? data.professionals.find((p) => p.id === next.professionalId) : null;
    return {
      cliente: cli?.name.split(' ')[0] ?? 'Maria',
      servico: svc?.name ?? 'Corte & Escova',
      profissional: pro?.name ?? 'Ana',
      data: next ? fmtShortDow(next.date) : 'sex, 20/06',
      hora: next ? minToTime(next.startMin) : '14:00',
      estabelecimento: data.settings.name,
    };
  }, [data, today]);

  const setTemplate = (k: 'confirmacao' | 'lembrete24' | 'lembrete2' | 'cancelamento', v: string) =>
    mutate((d) => ({ ...d, settings: { ...d.settings, templates: { ...d.settings.templates, [k]: v } } }));

  const resend = (id: string) => {
    const n = data.notifications.find((x) => x.id === id);
    if (!n) return;
    mutate((d) => ({
      ...d,
      notifications: [{ ...n, id: uid(), status: 'enviada' as const, at: new Date().toISOString() }, ...d.notifications],
    }));
    push(`Mensagem reenviada para ${n.phone} (simulado).`);
  };

  const sendTest = () => {
    mutate((d) => ({
      ...d,
      notifications: [{
        id: uid(), to: 'Número de teste', phone: '(11) 90000-0000', kind: 'confirmacao' as const,
        message: fillTemplate(d.settings.templates.confirmacao, sample),
        status: 'enviada' as const, at: new Date().toISOString(),
      }, ...d.notifications],
    }));
    push('Mensagem de teste enviada via WhatsApp Business API (simulado).');
  };

  return (
    <div>
      <PageHead title="WhatsApp" desc="Confirmações, lembretes automáticos e cancelamentos via WhatsApp Business Cloud API (simulado nesta demo).">
        <Btn variant="outline" icon="send" onClick={sendTest}>Enviar teste</Btn>
      </PageHead>

      {/* lembretes automáticos */}
      <section className="anim-fadeUp mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line bg-card px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mosssoft text-mossdark"><Icon name="bell" size={17} /></span>
          <div>
            <h2 className="font-display text-[14.5px] font-bold text-ink">Lembretes automáticos</h2>
            <p className="text-[12px] text-inksoft">Fila BullMQ verifica a agenda e dispara os templates abaixo.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={data.settings.reminders.h24} onChange={(v) => mutate((d) => ({ ...d, settings: { ...d.settings, reminders: { ...d.settings.reminders, h24: v } } }))}
            label="Lembrete 24h antes" />
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={data.settings.reminders.h2} onChange={(v) => mutate((d) => ({ ...d, settings: { ...d.settings, reminders: { ...d.settings.reminders, h2: v } } }))}
            label="Lembrete 2h antes" />
        </div>
      </section>

      {/* templates */}
      <div className="stagger mb-5 grid gap-4 md:grid-cols-2">
        {TPL_FIELDS.map((f) => (
          <TemplateCard key={f.key} fieldKey={f.key} label={f.label} desc={f.desc}
            value={data.settings.templates[f.key]} onChange={(v) => setTemplate(f.key, v)} sample={sample} />
        ))}
      </div>

      {/* log */}
      <section className="anim-fadeUp overflow-hidden rounded-xl border border-line bg-card" style={{ animationDelay: '.2s' }}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-[15px] font-bold text-ink">Histórico de envios</h2>
          <Badge tone="pine">{data.notifications.length} mensagens</Badge>
        </header>
        {data.notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-inkfaint">Nenhuma mensagem enviada ainda — confirme um agendamento para disparar a primeira.</p>
        ) : (
          <ul className="dark-scroll max-h-[420px] divide-y divide-line/70 overflow-y-auto">
            {data.notifications.map((n) => (
              <li key={n.id} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper/50">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mosssoft text-mossdark">
                  <Icon name="chat" size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold text-ink">{n.to}</p>
                    <span className="tnum text-[11.5px] font-medium text-inkfaint">{n.phone}</span>
                    <Badge tone={KIND_META[n.kind].tone}>{KIND_META[n.kind].label}</Badge>
                    <Badge tone={n.status === 'enviada' ? 'moss' : 'danger'}>{n.status}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-inksoft" title={n.message}>{n.message}</p>
                  <p className="mt-0.5 text-[10.5px] font-semibold text-inkfaint">
                    {new Date(n.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => resend(n.id)}
                  className="mt-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-inksoft opacity-0 transition-all hover:border-moss hover:text-mossdark group-hover:opacity-100">
                  reenviar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
