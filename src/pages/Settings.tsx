import { useState } from 'react';
import type { Role, User } from '../types';
import { ROLE_LABEL } from '../types';
import { useApp } from '../store';
import { todayISO } from '../lib/schedule';
import {
  Avatar, Badge, Btn, Confirm, Field, Icon, ImageUpload, Modal, PageHead, Select,
  TextArea, TextInput, useToast,
} from '../components/ui';

const ACCENTS = ['#a34a6d', '#b07c22', '#3a6ea5', '#157f63', '#6e4b7e', '#bf4f38'];
const TIMEZONES = ['America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Recife', 'America/Campo_Grande', 'America/Porto_Velho'];

export function SettingsPage() {
  const { data, mutate, currentUser, setUserRole, removeUser, inviteUser, changePassword } = useApp();
  const { push } = useToast();
  const s = data.settings;

  const [name, setName] = useState(s.name);
  const [category, setCategory] = useState(s.category);
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [timezone, setTimezone] = useState(s.timezone);

  const [invite, setInvite] = useState(false);
  const [toRemove, setToRemove] = useState<User | null>(null);

  /* minha conta */
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

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

  const submitPassword = () => {
    if (newPw !== confirmPw) { push('A confirmação não confere com a nova senha.', 'err'); return; }
    const r = changePassword(oldPw, newPw);
    if (!r.ok) { push(r.error ?? 'Não foi possível alterar a senha.', 'err'); return; }
    push('Senha atualizada com sucesso.');
    setOldPw(''); setNewPw(''); setConfirmPw('');
  };

  const onRoleChange = (u: User, r: Role) => {
    const res = setUserRole(u.id, r);
    if (!res.ok) { push(res.error ?? 'Não foi possível alterar o papel.', 'err'); return; }
    push(`Papel de ${u.name} alterado para ${ROLE_LABEL[r]}.`, 'info');
  };

  const onRemove = (u: User) => {
    const res = removeUser(u.id);
    if (!res.ok) { push(res.error ?? 'Não foi possível remover.', 'err'); return; }
    push(`${u.name} foi removido(a) da equipe.`);
  };

  return (
    <div>
      <PageHead title="Configurações" desc="Identidade do tenant, aparência, equipe com níveis de acesso, sua conta e LGPD." />

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
              <p className="mt-1.5 text-[11.5px] text-inkfaint">Todo dado é filtrado por <code className="font-mono">tenant_id</code> — um tenant nunca acessa dados de outro.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Btn icon="check" onClick={saveIdentity}>Salvar identidade</Btn>
          </div>
        </section>

        {/* aparência */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.08s' }}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
            <Icon name="star" size={16} className="text-inksoft" /> Aparência do portal
          </h2>
          <Field label="Cor de destaque">
            <div className="flex flex-wrap gap-2 pt-1">
              {ACCENTS.map((c) => (
                <button key={c} aria-label={`Cor ${c}`}
                  onClick={() => { mutate((d) => ({ ...d, settings: { ...d.settings, accent: c } })); push('Cor do portal atualizada.', 'info'); }}
                  className={`h-9 w-9 rounded-xl transition-transform hover:scale-110 ${s.accent === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="mt-4">
            <ImageUpload label="Logotipo (512×512 recomendado)" value={s.logoUrl}
              onChange={(v) => { mutate((d) => ({ ...d, settings: { ...d.settings, logoUrl: v } })); }} />
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: s.accent }}>
              {s.logoUrl
                ? <img src={s.logoUrl} alt="" className="h-11 w-11 rounded-xl border-2 border-white/70 object-cover" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white/70 bg-white/20 font-display text-[18px] font-bold text-white">{s.name[0] ?? '•'}</span>}
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
                  onChange={(e) => onRoleChange(u, e.target.value as Role)}
                  className="!w-40 !py-1.5 text-[12.5px]">
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
                {u.id !== currentUser.id && (
                  <button onClick={() => setToRemove(u)} className="rounded-md p-1.5 text-inksoft transition-colors hover:bg-dangersoft hover:text-danger" aria-label="Remover">
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-inkfaint">
            RBAC real por conta: Proprietário(a) tem acesso total · Gerente opera tudo exceto configurações · Recepção cuida de agenda, clientes e pagamentos · Profissional vê apenas a própria agenda.
          </p>
        </section>

        {/* minha conta */}
        <section className="anim-fadeUp rounded-xl border border-line bg-card p-5" style={{ animationDelay: '.2s' }}>
          <h2 className="mb-3 flex items-center gap-2 font-display text-[15.5px] font-bold text-ink">
            <Icon name="lock" size={16} className="text-inksoft" /> Minha conta & senha
          </h2>
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-paper/70 px-3.5 py-3">
            <Avatar name={currentUser.name} size={40} color={s.accent} />
            <div>
              <p className="text-[13.5px] font-bold text-ink">{currentUser.name}</p>
              <p className="text-[12px] text-inksoft">{currentUser.email} · {ROLE_LABEL[currentUser.role]}</p>
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Senha atual"><TextInput type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></Field>
            <Field label="Nova senha"><TextInput type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
            <Field label="Confirmar nova"><TextInput type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Btn icon="lock" onClick={submitPassword}>Alterar senha</Btn>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink"><Icon name="info" size={14} className="text-steel" /> Dados & LGPD</h3>
            <p className="mb-3 text-[12px] leading-relaxed text-inksoft">
              Todos os dados deste tenant ficam isolados por <code className="rounded bg-paper px-1 font-mono text-[11px] font-bold text-steel">tenant_id</code>.
              O titular pode exportar seus dados a qualquer momento.
            </p>
            <Btn variant="outline" icon="download" onClick={exportData}>Exportar dados (JSON)</Btn>
          </div>
        </section>
      </div>

      <InviteModal open={invite} onClose={() => setInvite(false)} onInvite={inviteUser} professionals={data.professionals} />

      <Confirm open={!!toRemove} onClose={() => setToRemove(null)} title="Remover da equipe"
        desc={`Remover “${toRemove?.name}” (${toRemove ? ROLE_LABEL[toRemove.role] : ''})? A pessoa perderá o acesso a este estabelecimento.`}
        onConfirm={() => { if (toRemove) onRemove(toRemove); }} />
    </div>
  );
}

function InviteModal({ open, onClose, onInvite, professionals }: {
  open: boolean;
  onClose: () => void;
  onInvite: (input: { name: string; email: string; role: Role; professionalId?: string }) => { ok: boolean; error?: string; token?: { token: string; email: string } };
  professionals: { id: string; name: string }[];
}) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('receptionist');
  const [professionalId, setProfessionalId] = useState('');

  const send = () => {
    const r = onInvite({ name, email, role, professionalId: role === 'professional' ? (professionalId || undefined) : undefined });
    if (!r.ok) { push(r.error ?? 'Não foi possível convidar.', 'err'); return; }
    push(`Convite criado para ${email}. O código de ativação está na caixa de e-mails (ícone no topo).`, 'info');
    setName(''); setEmail(''); setRole('receptionist'); setProfessionalId('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Convidar para a equipe"
      subtitle="A pessoa recebe um código por e-mail para ativar a conta e definir a senha."
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="mail" onClick={send}>Gerar convite</Btn></>}>
      <div className="space-y-3.5">
        <Field label="Nome" req><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="E-mail" req><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" /></Field>
        <Field label="Papel / nível de acesso">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        {role === 'professional' && (
          <Field label="Vincular ao profissional (agenda própria)">
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">— sem vínculo —</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        <p className="rounded-lg bg-steelsoft px-3 py-2 text-[11.5px] font-medium leading-relaxed text-[#2c4f6e]">
          Como não há servidor de e-mail neste demo, o código de ativação fica visível na <strong>caixa de e-mails de demonstração</strong> (ícone de envelope no topo).
        </p>
      </div>
    </Modal>
  );
}
