import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PageId } from '../types';
import { ACCESS, ROLE_LABEL } from '../types';
import { useApp } from '../store';
import { fmtShortDow, pad2 } from '../lib/schedule';
import { Avatar, Icon, useToast } from './ui';

const NAV: { group: string; items: { id: PageId; label: string; icon: string }[] }[] = [
  { group: 'Operação', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'agenda', label: 'Agenda', icon: 'calendar' },
    { id: 'blocks', label: 'Bloqueios', icon: 'ban' },
  ]},
  { group: 'Cadastros', items: [
    { id: 'services', label: 'Serviços & Produtos', icon: 'scissors' },
    { id: 'clients', label: 'Clientes', icon: 'users' },
    { id: 'professionals', label: 'Profissionais', icon: 'user' },
  ]},
  { group: 'Gestão', items: [
    { id: 'hours', label: 'Horário de funcionamento', icon: 'clock' },
    { id: 'payments', label: 'Pagamentos', icon: 'wallet' },
    { id: 'notifications', label: 'WhatsApp', icon: 'chat' },
    { id: 'settings', label: 'Configurações', icon: 'gear' },
  ]},
];

const pageLabel = (id: PageId) => NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? '';

export function Shell({ children }: { children: ReactNode }) {
  const { data, role, page, nav, currentUser, setPortalOpen, logout, cloud, retryCloud } = useApp();
  const { push } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, []);

  const allowed = ACCESS[role];
  const canSettings = allowed.includes('settings');

  const sidebar = (
    <div className="flex h-full w-[248px] flex-col bg-pine text-[#c8d6ce]">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine3 text-mint">
          <Icon name="calendar" size={20} />
        </span>
        <div>
          <p className="font-display text-[17px] font-bold leading-none text-white">Agendou</p>
          <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint/70">multi-tenant</p>
        </div>
      </div>

      <div className="mx-3 mb-4 rounded-xl border border-pine3 bg-pine2/60 px-3 py-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-mint/60">Seu estabelecimento</p>
        <div className="mt-1.5 flex items-center gap-2">
          {data.settings.logoUrl ? (
            <img src={data.settings.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg font-display text-[13px] font-bold text-white" style={{ background: data.settings.accent }}>
              {data.settings.name[0] ?? '•'}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{data.settings.name}</p>
            <p className="truncate text-[11px] text-[#9db3a7]">{data.settings.slug}.agendou.app</p>
          </div>
        </div>
      </div>

      <nav className="dark-scroll flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mb-3">
            <p className="mb-1 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#6f8a7c]">{g.group}</p>
            {g.items.map((item) => {
              const locked = !allowed.includes(item.id);
              const active = page === item.id;
              return (
                <button key={item.id}
                  onClick={() => {
                    if (locked) { push(`“${item.label}” não está liberado para o seu papel (${ROLE_LABEL[role]}).`, 'err'); return; }
                    nav(item.id); setMobileOpen(false);
                  }}
                  className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition-all duration-150 ${
                    active ? 'bg-moss text-white shadow-sm' : locked ? 'text-[#5f7a6d]' : 'hover:bg-pine2 hover:text-white'}`}>
                  <Icon name={item.icon} size={16} className={active ? 'text-mint' : ''} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {locked && <Icon name="lock" size={13} className="text-[#5f7a6d]" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-pine3 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-pine2/70 px-2.5 py-2">
          <Avatar name={currentUser.name} size={30} color={data.settings.accent} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{currentUser.name}</p>
            <p className="truncate text-[11px] text-[#9db3a7]">{ROLE_LABEL[role]}</p>
          </div>
          <button onClick={() => { logout(); }} aria-label="Sair"
            className="rounded-md p-1.5 text-[#9db3a7] transition-colors hover:bg-pine3 hover:text-white">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="anim-fadeIn absolute inset-0 bg-pine/60" onClick={() => setMobileOpen(false)} />
          <div className="anim-slideLeft absolute inset-y-0 left-0 shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-sm lg:px-6">
          <button className="rounded-lg border border-line bg-card p-2 text-ink lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Icon name="menu" size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[16px] font-bold text-ink">{pageLabel(page)}</h2>
            <p className="hidden text-[11.5px] font-medium text-inksoft sm:block">
              {fmtShortDow(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`)} · {pad2(now.getHours())}:{pad2(now.getMinutes())} · {data.settings.timezone.replace('_', ' ')}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                if (cloud === 'error') { retryCloud(); push('Tentando reconectar ao Neon…', 'info'); return; }
                if (cloud === 'off') push('Modo local: sem backend detectado. Na Vercel com DATABASE_URL, os dados persistem no Neon.', 'info');
                if (cloud === 'synced') push('Dados sincronizados com o Neon (Postgres serverless) via Vercel Functions.', 'info');
                if (cloud === 'saving') push('Enviando alterações para o Neon…', 'info');
              }}
              title="Status da sincronização Vercel + Neon"
              className="hidden items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-2.5 pr-3 text-[12px] font-bold text-inksoft transition-all hover:border-inkfaint hover:text-ink sm:inline-flex">
              <span className={`relative inline-flex h-2 w-2 rounded-full ${
                cloud === 'synced' ? 'bg-moss' : cloud === 'saving' ? 'bg-amber pulse-dot' : cloud === 'error' ? 'bg-danger' : cloud === 'checking' ? 'bg-steel pulse-dot' : 'bg-inkfaint'
              }`} />
              {cloud === 'checking' && 'verificando nuvem…'}
              {cloud === 'off' && 'armazenamento local'}
              {cloud === 'saving' && 'salvando no Neon…'}
              {cloud === 'synced' && <span className="text-mossdark">Neon · sincronizado</span>}
              {cloud === 'error' && <span className="text-danger">falha de sync — retry</span>}
            </button>

            <button onClick={() => setPortalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold text-white shadow-sm transition-transform duration-150 hover:scale-[1.03] active:scale-[.97]"
              style={{ background: data.settings.accent }}>
              <Icon name="eye" size={15} />
              <span className="hidden sm:inline">Portal do cliente</span>
              <span className="sm:hidden">Portal</span>
            </button>

            {/* menu da conta */}
            <div className="relative" ref={acctRef}>
              <button onClick={() => setAcctOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-line bg-card px-2 py-1.5 transition-colors hover:border-inkfaint">
                <Avatar name={currentUser.name} size={26} color={data.settings.accent} />
                <Icon name="chevD" size={14} className={`text-inksoft transition-transform ${acctOpen ? 'rotate-180' : ''}`} />
              </button>
              {acctOpen && (
                <div className="anim-scaleIn absolute right-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-line bg-card p-1.5 shadow-xl">
                  <div className="border-b border-line px-2.5 pb-2.5 pt-2">
                    <p className="truncate text-[13.5px] font-bold text-ink">{currentUser.name}</p>
                    <p className="truncate text-[11.5px] text-inksoft">{currentUser.email}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-mosssoft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-mossdark">
                      <Icon name="lock" size={11} /> {ROLE_LABEL[role]}
                    </span>
                  </div>
                  {canSettings && (
                    <button onClick={() => { nav('settings'); setAcctOpen(false); }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-ink transition-colors hover:bg-paper">
                      <Icon name="gear" size={15} className="text-inksoft" /> Configurações & minha conta
                    </button>
                  )}
                  <button onClick={() => { setAcctOpen(false); logout(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-danger transition-colors hover:bg-dangersoft">
                    <Icon name="logout" size={15} /> Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div key={page + data.settings.slug} className="anim-fadeUp mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
