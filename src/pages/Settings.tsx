import { useState } from 'react';
import type { Role } from '../types';
import { ROLE_LABEL } from '../types';
import { useApp } from '../store';
import { todayISO, uid } from '../lib/schedule';
import {
  Avatar, Badge, Btn, Confirm, Field, Icon, ImageUpload, Modal, PageHead, Select, TextInput, useToast,
} from '../components/ui';

const ACCENTS = ['#a34a6d', '#b07c22', '#3a6ea5', '#157f63', '#6e4b7e', '#bf4f38'];
const TIMEZONES = ['America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Recife', 'America/Campo_Grande', 'America/Porto_Velho'];

export function SettingsPage() {
  const { data, mutate, resetTenant, currentUser } = useApp();
  const { push } = useToast();
  const s = data.settings;

  const [name, setName] = useState(s.name);
  const [category, setCategory] = useState(s.category);
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [timezone, setTimezone] = useState(s.timezone);
  const [invite, setInvite] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<Role>('receptionist');
  const [resetOpen, setResetOpen] = useState(false);

  const saveIdentity = () => {
    if (name.trim().length < 2) { push('Nome do estabelecimento muito curto.', 'err'); return; }
    mutate((d) => ({
      ...d,
      settings: { ...d.settings, name: name.trim(), category: category.trim(), phone: phone.trim(), address: address.trim(), timezone },
    }));
    push('Identidade do estabelecimento salva.');
  };

  const copySlug = async () => {
    try {
      await navigator.clipboard.writeText(`${s.slug}.agendou.app`);
      push('Subdomínio copiado para a área de transferência.');
    } catch {
      push('Não foi possível copiar automaticamente.', 'err');
    }
  };

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lgpd-${s.slug}-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    push('Exportação LGPD gerada — arquivo JSON baixado.');
  };

  const sendInvite = () => {
    if (invName.trim().length < 2 || !invEmail.includes('@')) { push('Preencha nome e e-mail válidos para o convite.', 'err'); return; }
    mutate((d) => ({
      ...d,
      users: [...d.users, { id: uid(), name: invName.trim(), email: invEmail.trim(), role: invRole, status: 'convidado' as const }],
    }));
    push(`Convite enviado para ${invEmail.trim()} com papel “${ROLE_LABEL[invRole]}” (simulado).`);
    setInvite(false); setInvName(''); setInvEmail('');
  };

  return (
    <div>
      <PageHead title="Configurações" desc="Identidade do tenant, aparência do portal, equipe e conformidade LGPD." />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* identidade */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
            <Icon name="gear" size={16} className="text-inksoft" /> Identidade do estabelecimento
          </h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Nome" req><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Categoria"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
            <Field label="Telefone / WhatsApp"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Fuso horário">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Endereço" className="sm:col-span-2"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Subdomínio do portal (fixo por tenant)</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] font-bold text-steel">{s.slug}.agendou.app</code>
                <Btn variant="outline" icon="copy" onClick={copySlug}>Copiar</Btn>
              </div>
              <p className="mt-1.5 text-[11.5px] text-inkfaint">Resolvido pelo middleware de tenant a cada requisição — dados isolados por subdomínio.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Btn icon="check" onClick={saveIdentity}>Salvar identidade</Btn>
          </div>
        </section>

        {/* aparência */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.08s' }}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
            <Icon name="spark" size={16} className="text-inksoft" /> Aparência do portal
          </h2>
          <Field label="Cor de destaque">
            <div className="flex flex-wrap gap-2 pt-1">
              {ACCENTS.map((c) => (
                <button key={c} aria-label={`Cor ${c}`} onClick={() => { mutate((d) => ({ ...d, settings: { ...d.settings, accent: c } })); push('Cor do portal atualizada.', 'info'); }}
                  className={`h-9 w-9 rounded-xl transition-transform hover:scale-110 ${s.accent === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="mt-4">
            <ImageUpload label="Logotipo (512×512 recomendado)" value={s.logoUrl}
              onChange={(v) => { mutate((d) => ({ ...d, settings: { ...d.settings, logoUrl: v } })); }} />
          </div>

          {/* prévia */}
          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: s.accent }}>
              {s.logoUrl
                ? <img src={s.logoUrl} alt="" className="h-11 w-11 rounded-xl border-2 border-white/70 object-cover" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white/70 bg-white/20 font-display text-[18px] font-bold text-white">{s.name[0]}</span>}
              <div>
                <p className="font-display text-[15px] font-bold text-white">{s.name}</p>
                <p className="text-[11.5px] font-semibold text-white/80">{s.category} · {s.slug}.agendou.app</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white px-4 py-3">
              <p className="text-[12px] font-medium text-inksoft">Prévia da cabeceira do portal do cliente</p>
              <span className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: s.accent }}>Agendar agora</span>
            </div>
          </div>
        </section>

        {/* equipe */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.14s' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
              <Icon name="users" size={16} className="text-inksoft" /> Equipe & níveis de acesso
            </h2>
            <Btn size="sm" variant="outline" icon="mail" onClick={() => setInvite(true)}>Convidar</Btn>
          </div>
          <ul className="space-y-2">
            {data.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
                <Avatar name={u.name} size={34} color={s.accent} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-ink">
                    {u.name}
                    {u.id === currentUser.id && <span className="ml-1.5 text-[10.5px] font-bold uppercase text-moss">(você)</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-inksoft">{u.email}</p>
                </div>
                <Badge tone={u.status === 'ativo' ? 'moss' : 'amber'}>{u.status === 'ativo' ? 'ativo' : 'convite pendente'}</Badge>
                <Select value={u.role} disabled={u.id === currentUser.id}
                  onChange={(e) => {
                    const r = e.target.value as Role;
                    mutate((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, role: r } : x)) }));
                    push(`Papel de ${u.name} alterado para ${ROLE_LABEL[r]}.`, 'info');
                  }}
                  className="!w-40 !py-1.5 text-[12.5px]">
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-inkfaint">
            RBAC aplicado na interface: Proprietário(a) tem acesso total · Gerente opera tudo exceto configurações · Recepção cuida de agenda, clientes e pagamentos · Profissional vê apenas a própria agenda.
          </p>
        </section>

        {/* LGPD */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.2s' }}>
          <h2 className="mb-3 flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
            <Icon name="lock" size={16} className="text-inksoft" /> Dados & LGPD
          </h2>
          <p className="mb-4 text-[12.5px] leading-relaxed text-inksoft">
            Todos os dados deste tenant ficam isolados por <code className="rounded bg-paper px-1 font-mono text-[11.5px] font-bold text-steel">tenant_id</code> (com Row Level
            Security no PostgreSQL em produção). O titular pode exportar ou solicitar a eliminação dos dados.
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" icon="download" onClick={exportData}>Exportar dados (JSON)</Btn>
            <Btn variant="dangerSoft" icon="refresh" onClick={() => setResetOpen(true)}>Restaurar dados de demonstração</Btn>
          </div>
          <div className="mt-4 rounded-lg bg-paper/70 px-3.5 py-3">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-inkfaint">Resumo deste tenant</p>
            <p className="tnum mt-1 text-[12.5px] font-medium text-inksoft">
              {data.clients.length} clientes · {data.appointments.length} agendamentos · {data.professionals.length} profissionais · {data.services.length} serviços · {data.notifications.length} notificações
            </p>
          </div>
        </section>
      </div>

      {/* convite */}
      <Modal open={invite} onClose={() => setInvite(false)} title="Convidar funcionário"
        subtitle="A pessoa recebe um e-mail com link para definir a senha e assumir o papel."
        footer={<><Btn variant="ghost" onClick={() => setInvite(false)}>Cancelar</Btn><Btn icon="mail" onClick={sendInvite}>Enviar convite</Btn></>}>
        <div className="space-y-3.5">
          <Field label="Nome" req><TextInput value={invName} onChange={(e) => setInvName(e.target.value)} /></Field>
          <Field label="E-mail" req><TextInput type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="pessoa@empresa.com" /></Field>
          <Field label="Papel / nível de acesso">
            <Select value={invRole} onChange={(e) => setInvRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <Confirm open={resetOpen} onClose={() => setResetOpen(false)} title="Restaurar demonstração"
        confirmLabel="Restaurar" danger
        desc={`Substituir todos os dados de “${s.name}” pelos dados originais de demonstração? Alterações feitas (agenda, clientes, horários) serão perdidas.`}
        onConfirm={() => { resetTenant(); push('Dados de demonstração restaurados.'); }} />
    </div>
  );
}
