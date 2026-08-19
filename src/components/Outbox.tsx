import { useState } from 'react';
import type { Token } from '../types';
import { useApp } from '../store';
import { Btn, Icon, Modal, useToast } from './ui';

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function Outbox() {
  const { tokens, redeemToken, session } = useApp();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const activeToken = tokens.find((t) => t.id === active) ?? null;

  const copy = async (tk: Token) => {
    try {
      await navigator.clipboard.writeText(tk.token);
      push('Código copiado para a área de transferência.');
    } catch {
      push('Não foi possível copiar.', 'err');
    }
  };

  const submit = () => {
    if (!activeToken) return;
    if (pw !== pw2) { push('As senhas não conferem.', 'err'); return; }
    const r = redeemToken(activeToken.id, pw);
    if (!r.ok) { push(r.error ?? 'Não foi possível.', 'err'); return; }
    const wasInvite = activeToken.type === 'invite';
    push(wasInvite
      ? `Conta de ${activeToken.email} ativada! Entre com esse e-mail e a nova senha.`
      : 'Senha redefinida com sucesso. Entre com a nova senha.');
    setActive(null); setPw(''); setPw2('');
  };

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Caixa de e-mails de demonstração"
        title="E-mails de demonstração (convites e recuperação de senha)"
        className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-pine text-mint shadow-lg transition-all duration-200 hover:scale-110 hover:bg-pine2 active:scale-95">
        <Icon name="mail" size={20} />
        {tokens.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 font-display text-[11px] font-bold text-white">
            {tokens.length}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setActive(null); }} w="max-w-xl"
        title="Caixa de e-mails · demonstração"
        subtitle="Como não há servidor de e-mail neste demo, convites e códigos de recuperação chegam aqui.">
        {tokens.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-paper text-inkfaint">
              <Icon name="mail" size={24} />
            </span>
            <p className="text-[13.5px] font-bold text-ink">Caixa vazia</p>
            <p className="mt-0.5 text-[12px] text-inksoft">Convites de equipe e recuperações de senha aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {tokens.map((tk) => {
              const expired = new Date(tk.expiresAt).getTime() < Date.now();
              const isOpen = active === tk.id;
              return (
                <li key={tk.id} className={`rounded-xl border bg-white p-3.5 transition-all ${expired ? 'border-line opacity-55' : 'border-line'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tk.type === 'invite' ? 'bg-mosssoft text-mossdark' : 'bg-ambersoft text-amber'}`}>
                      <Icon name={tk.type === 'invite' ? 'users' : 'lock'} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-ink">
                        {tk.type === 'invite' ? 'Convite para equipe' : 'Recuperação de senha'}
                        <span className="ml-2 text-[11px] font-semibold text-inksoft">para {tk.email}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-inkfaint">
                        {tk.type === 'invite' ? `Acesso ao tenant “${tk.tenantId}” · ` : ''}
                        enviado {fmtWhen(tk.createdAt)} · {expired ? 'expirado' : `expira ${fmtWhen(tk.expiresAt)}`}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <code className="flex-1 truncate rounded-md border border-line bg-paper px-2 py-1 font-mono text-[11px] font-bold text-steel">
                          {tk.token.slice(0, 22)}…
                        </code>
                        <button onClick={() => copy(tk)} className="rounded-md p-1.5 text-inksoft transition-colors hover:bg-ink/5 hover:text-ink" aria-label="Copiar código">
                          <Icon name="copy" size={14} />
                        </button>
                      </div>
                    </div>
                    {!expired && !isOpen && (
                      <Btn size="sm" variant="soft" onClick={() => { setActive(tk.id); setPw(''); setPw2(''); }}>
                        {tk.type === 'invite' ? 'Ativar conta' : 'Redefinir'}
                      </Btn>
                    )}
                  </div>

                  {isOpen && (
                    <div className="anim-drawIn mt-3 border-t border-line pt-3">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11.5px] font-semibold text-inksoft">Nova senha</label>
                          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:border-moss" placeholder="mín. 6 caracteres" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11.5px] font-semibold text-inksoft">Confirmar senha</label>
                          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:border-moss" />
                        </div>
                      </div>
                      <div className="mt-2.5 flex justify-end gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => setActive(null)}>Cancelar</Btn>
                        <Btn size="sm" icon="check" onClick={submit}>
                          {tk.type === 'invite' ? 'Ativar e definir senha' : 'Salvar nova senha'}
                        </Btn>
                      </div>
                      {session && tk.type === 'invite' && (
                        <p className="mt-2 text-[11px] font-medium text-amber">
                          Você está logado(a) como outra conta — após ativar, saia e entre com {tk.email}.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </>
  );
}
