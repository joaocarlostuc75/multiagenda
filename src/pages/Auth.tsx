import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import type { RegisterInput } from '../store';
import { slugify } from '../data/seed';
import { validEmail } from '../lib/auth';
import { Btn, Icon, Select, TextInput, useToast } from '../components/ui';

type Mode = 'login' | 'register' | 'forgot';

const ACCENTS = ['#a34a6d', '#b07c22', '#3a6ea5', '#157f63', '#6e4b7e', '#bf4f38'];
const TIMEZONES = ['America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Recife', 'America/Campo_Grande', 'America/Porto_Velho'];

function BrandPanel() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative hidden flex-col overflow-hidden bg-pine text-[#c8d6ce] lg:flex">
      {/* camadas ambiente */}
      <div className="pointer-events-none absolute inset-0 hatch opacity-[0.05]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-moss/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-mint/10 blur-3xl" />

      <div className="relative flex items-center gap-2.5 px-9 pt-9">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine3 text-mint"><Icon name="calendar" size={22} /></span>
        <div>
          <p className="font-display text-[19px] font-bold leading-none text-white">Agendou</p>
          <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mint/70">agendamento multi-tenant</p>
        </div>
      </div>

      <div className="relative mt-14 px-9">
        <h1 className="font-display text-[34px] font-bold leading-[1.12] tracking-tight text-white">
          Cada estabelecimento,<br />seu próprio painel.
        </h1>
        <p className="mt-4 max-w-[380px] text-[14.5px] leading-relaxed text-[#9db3a7]">
          Agenda, clientes, serviços, pagamentos e portal de agendamento online — com dados
          totalmente isolados entre salões, barbearias, estéticas e clínicas.
        </p>

        <ul className="mt-9 space-y-4">
          {[
            { ic: 'lock', t: 'Login com RBAC', d: 'Proprietário, gerente, recepção e profissional — cada um vê só o que deve.' },
            { ic: 'users', t: 'Isolamento por tenant', d: 'Todo dado é filtrado por tenant_id. Um salão nunca acessa o outro.' },
            { ic: 'chat', t: 'Portal do cliente', d: 'Página pública com a identidade do estabelecimento para agendar online.' },
          ].map((f) => (
            <li key={f.t} className="flex gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pine3 text-mint"><Icon name={f.ic} size={17} /></span>
              <div>
                <p className="text-[14px] font-bold text-white">{f.t}</p>
                <p className="text-[12.5px] leading-relaxed text-[#9db3a7]">{f.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* elemento vivo: cartões de agendamento */}
      <div className="relative mt-auto px-9 pb-9">
        <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold text-[#9db3a7]">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mint pulse-dot" />
          Agenda ao vivo · {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="space-y-2.5">
          {[
            { c: '#c25e7c', h: '09:30', n: 'Corte & Escova', p: 'Ana', d: 0 },
            { c: '#3e8e9e', h: '10:15', n: 'Manicure', p: 'Bela', d: 1 },
            { c: '#c98a2d', h: '11:00', n: 'Limpeza de Pele', p: 'Carla', d: 2 },
          ].map((a) => (
            <div key={a.h} className="anim-fadeUp flex items-center gap-3 rounded-xl border border-pine3 bg-pine2/70 px-4 py-3 backdrop-blur-sm"
              style={{ animationDelay: `${0.15 + a.d * 0.12}s` }}>
              <span className="h-8 w-1 rounded-full" style={{ background: a.c }} />
              <span className="tnum font-display text-[14px] font-bold text-white">{a.h}</span>
              <span className="flex-1 truncate text-[13px] font-semibold text-[#c8d6ce]">{a.n}</span>
              <span className="rounded-full bg-pine3 px-2.5 py-0.5 text-[11px] font-bold text-mint">{a.p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const { login, register, requestReset } = useApp();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [err, setErr] = useState('');

  /* login */
  const [lEmail, setLEmail] = useState('');
  const [lPw, setLPw] = useState('');

  /* recuperar */
  const [fEmail, setFEmail] = useState('');
  const [forgotDone, setForgotDone] = useState(false);

  /* cadastro */
  const [reg, setReg] = useState<RegisterInput>({
    tenantName: '', category: '', phone: '', address: '', timezone: 'America/Sao_Paulo',
    accent: ACCENTS[3], ownerName: '', ownerEmail: '', ownerPassword: '',
  });
  const [regConfirm, setRegConfirm] = useState('');

  const slugPreview = useMemo(() => (reg.tenantName.trim() ? slugify(reg.tenantName) : 'meu-negocio'), [reg.tenantName]);

  const set = (k: keyof RegisterInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setReg((r) => ({ ...r, [k]: e.target.value }));

  const switchMode = (m: Mode) => { setMode(m); setErr(''); setForgotDone(false); };

  const doLogin = () => {
    if (!validEmail(lEmail)) { setErr('Informe um e-mail válido.'); return; }
    const r = login(lEmail, lPw);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível entrar.'); return; }
    push('Bem-vindo(a) de volta!');
  };

  const doForgot = () => {
    if (!validEmail(fEmail)) { setErr('Informe um e-mail válido.'); return; }
    const r = requestReset(fEmail);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível.'); return; }
    setErr('');
    setForgotDone(true);
    push('Código de recuperação gerado — abra a caixa de e-mails (ícone do envelope).', 'info');
  };

  const doRegister = () => {
    if (reg.ownerPassword !== regConfirm) { setErr('As senhas não conferem.'); return; }
    const r = register(reg);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível criar a conta.'); return; }
    push('Estabelecimento criado! Seu painel está pronto — comece cadastrando serviços.');
  };

  return (
    <div className="grid h-full lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="dark-scroll flex items-center justify-center overflow-y-auto bg-paper px-4 py-8">
        <div className="anim-fadeUp w-full max-w-[440px]">
          {/* logo mobile */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine text-mint"><Icon name="calendar" size={22} /></span>
            <div>
              <p className="font-display text-[19px] font-bold leading-none text-ink">Agendou</p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-inkfaint">agendamento multi-tenant</p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
            {mode === 'login' && (
              <>
                <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Entrar no painel</h2>
                <p className="mt-1 text-[13px] text-inksoft">Acesse o painel do seu estabelecimento.</p>
                <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">E-mail</label>
                    <TextInput type="email" value={lEmail} onChange={(e) => setLEmail(e.target.value)} placeholder="voce@seunegocio.com" autoFocus />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-[12.5px] font-semibold text-inksoft">Senha</label>
                      <button type="button" onClick={() => switchMode('forgot')} className="text-[12px] font-bold text-moss transition-colors hover:text-mossdark">Esqueci minha senha</button>
                    </div>
                    <TextInput type="password" value={lPw} onChange={(e) => setLPw(e.target.value)} placeholder="••••••••" />
                  </div>
                  {err && <InlineError msg={err} />}
                  <Btn type="submit" icon="logout" className="w-full justify-center">Entrar</Btn>
                </form>
                <p className="mt-6 border-t border-line pt-5 text-center text-[13px] text-inksoft">
                  Ainda não tem um estabelecimento?{' '}
                  <button onClick={() => switchMode('register')} className="font-bold text-moss transition-colors hover:text-mossdark">Criar conta grátis</button>
                </p>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <button onClick={() => switchMode('login')} className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-moss transition-colors hover:text-mossdark">
                  <Icon name="arrowL" size={14} /> Voltar ao login
                </button>
                <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Recuperar senha</h2>
                <p className="mt-1 text-[13px] text-inksoft">Informe seu e-mail e enviaremos um código para redefinir a senha.</p>
                {forgotDone ? (
                  <div className="anim-drawIn mt-6 rounded-xl border border-moss/30 bg-mosssoft px-4 py-4">
                    <p className="flex items-center gap-2 text-[13.5px] font-bold text-mossdark"><Icon name="check" size={16} /> Código enviado!</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[#0d503d]">
                      Abra a <strong>caixa de e-mails</strong> (ícone do envelope, canto inferior direito) e clique em <strong>“Redefinir”</strong> para criar uma nova senha.
                    </p>
                  </div>
                ) : (
                  <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); doForgot(); }}>
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">E-mail da conta</label>
                      <TextInput type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="voce@seunegocio.com" autoFocus />
                    </div>
                    {err && <InlineError msg={err} />}
                    <Btn type="submit" icon="mail" className="w-full justify-center">Enviar código</Btn>
                  </form>
                )}
              </>
            )}

            {mode === 'register' && (
              <>
                <button onClick={() => switchMode('login')} className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-moss transition-colors hover:text-mossdark">
                  <Icon name="arrowL" size={14} /> Já tenho conta
                </button>
                <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Criar estabelecimento</h2>
                <p className="mt-1 text-[13px] text-inksoft">Comece do zero — seu painel nasce isolado e sem dados fictícios.</p>
                <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); doRegister(); }}>
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-inkfaint">O estabelecimento</p>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Nome *</label>
                        <TextInput value={reg.tenantName} onChange={set('tenantName')} placeholder="Ex.: Studio Aurora" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Categoria</label>
                        <TextInput value={reg.category} onChange={set('category')} placeholder="Salão, barbearia…" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Telefone</label>
                        <TextInput value={reg.phone} onChange={set('phone')} placeholder="(11) 99999-0000" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Endereço</label>
                        <TextInput value={reg.address} onChange={set('address')} placeholder="Rua, número · bairro, cidade/UF" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Fuso horário</label>
                        <Select value={reg.timezone} onChange={(e) => setReg((r) => ({ ...r, timezone: e.target.value }))}>
                          {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Cor da marca</label>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ACCENTS.map((c) => (
                            <button type="button" key={c} aria-label={`Cor ${c}`} onClick={() => setReg((r) => ({ ...r, accent: c }))}
                              className={`h-7 w-7 rounded-lg transition-transform hover:scale-110 ${reg.accent === c ? 'ring-2 ring-ink ring-offset-1' : ''}`} style={{ background: c }} />
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-[11.5px] font-semibold text-inkfaint">Seu portal ficará em</span>
                        <code className="block rounded-lg border border-dashed border-line bg-paper px-3 py-2 font-mono text-[12.5px] font-bold text-steel">{slugPreview}.agendou.app</code>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-inkfaint">Sua conta (proprietário)</p>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Seu nome *</label>
                        <TextInput value={reg.ownerName} onChange={set('ownerName')} placeholder="Nome completo" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">E-mail *</label>
                        <TextInput type="email" value={reg.ownerEmail} onChange={set('ownerEmail')} placeholder="voce@seunegocio.com" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Senha *</label>
                        <TextInput type="password" value={reg.ownerPassword} onChange={set('ownerPassword')} placeholder="mín. 6 caracteres" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">Confirmar *</label>
                        <TextInput type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {err && <InlineError msg={err} />}
                  <Btn type="submit" icon="check" className="w-full justify-center" style={{ background: reg.accent }}>Criar meu estabelecimento</Btn>
                  <p className="text-center text-[11px] leading-relaxed text-inkfaint">
                    Ao criar, você concorda com o tratamento dos seus dados conforme a LGPD.
                  </p>
                </form>
              </>
            )}
          </div>

          <p className="mt-5 text-center text-[11.5px] text-inkfaint">
            Demo: convites e recuperações de senha chegam na caixa de e-mails (ícone do envelope).
          </p>
        </div>
      </div>
    </div>
  );
}

function InlineError({ msg }: { msg: string }) {
  return (
    <p className="anim-drawIn flex items-start gap-1.5 rounded-lg border border-danger/25 bg-dangersoft px-3 py-2 text-[12.5px] font-bold text-danger">
      <Icon name="alert" size={14} className="mt-0.5 shrink-0" />{msg}
    </p>
  );
}
