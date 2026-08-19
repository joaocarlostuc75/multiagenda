import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PageId, Role, Session, TenantData, Token, User } from './types';
import { createEmptyTenant, createOwner, emptyTenant, PLACEHOLDER_USER, slugify } from './data/seed';
import { generateToken, hashPassword, passwordIssue, validEmail, verifyPassword } from './lib/auth';
import { uid } from './lib/schedule';
import { checkCloud, loadTenant, saveTenant } from './lib/cloudSync';

const DATA_KEY = 'agendou:v2:data';
const SESSION_KEY = 'agendou:v2:session';
const TOKENS_KEY = 'agendou:v2:tokens';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const EMPTY_TENANT = emptyTenant();

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export type Result = { ok: boolean; error?: string; token?: Token };
export type CloudStatus = 'checking' | 'off' | 'saving' | 'synced' | 'error';
export type Intent = { kind: 'new-appointment' } | null;

export type RegisterInput = {
  tenantName: string;
  category: string;
  phone: string;
  address: string;
  timezone: string;
  accent: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
};

export type InviteInput = {
  name: string;
  email: string;
  role: Role;
  professionalId?: string;
};

type StoreCtx = {
  /* sessão */
  session: Session | null;
  tenantId: string;
  data: TenantData;
  currentUser: User;
  role: Role;
  mutate: (fn: (d: TenantData) => TenantData) => void;

  /* navegação */
  page: PageId;
  nav: (p: PageId) => void;
  intent: Intent;
  setIntent: (i: Intent) => void;
  portalOpen: boolean;
  setPortalOpen: (b: boolean) => void;

  /* autenticação */
  tokens: Token[];
  login: (email: string, password: string) => Result;
  logout: () => void;
  register: (input: RegisterInput) => Result;
  requestReset: (email: string) => Result;
  inviteUser: (input: InviteInput) => Result;
  redeemToken: (tokenId: string, newPassword: string) => Result;
  changePassword: (oldPw: string, newPw: string) => Result;
  setUserRole: (userId: string, role: Role) => Result;
  removeUser: (userId: string) => Result;

  /* nuvem */
  cloud: CloudStatus;
  retryCloud: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dbs, setDbs] = useState<Record<string, TenantData>>(() => loadJSON(DATA_KEY, {}));
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadJSON<Session | null>(SESSION_KEY, null);
    if (!s) return null;
    const d = loadJSON<Record<string, TenantData>>(DATA_KEY, {});
    const u = d[s.tenantId]?.users.find((x) => x.id === s.userId);
    return u ? s : null;
  });
  const [tokens, setTokens] = useState<Token[]>(() => loadJSON(TOKENS_KEY, []));
  const [page, setPage] = useState<PageId>('dashboard');
  const [intent, setIntent] = useState<Intent>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>('checking');

  const dbsRef = useRef(dbs);
  dbsRef.current = dbs;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const cloudOn = useRef(false);
  const justPulled = useRef<Record<string, number>>({});

  /* ---------- derivações ---------- */
  const tenantId = session?.tenantId ?? '';
  const data = tenantId && dbs[tenantId] ? dbs[tenantId] : EMPTY_TENANT;

  const currentUser = useMemo<User>(() => {
    if (!session) return PLACEHOLDER_USER;
    const d = dbs[session.tenantId];
    return d?.users.find((u) => u.id === session.userId) ?? PLACEHOLDER_USER;
  }, [dbs, session]);

  const role_: Role = currentUser.role;

  /* ---------- persistência ---------- */
  useEffect(() => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(dbs)); } catch { /* quota */ }
  }, [dbs]);
  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* noop */ }
  }, [session]);
  useEffect(() => {
    try { localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens)); } catch { /* noop */ }
  }, [tokens]);

  /* ---------- nuvem (Vercel + Neon) ---------- */
  const pull = useCallback(async (tid: string) => {
    if (!tid) return;
    const remote = await loadTenant(tid);
    if (remote.data) {
      justPulled.current[tid] = Date.now();
      setDbs((prev) => ({ ...prev, [tid]: remote.data as TenantData }));
    } else if (dbsRef.current[tid]) {
      void saveTenant(tid, dbsRef.current[tid]).catch(() => undefined);
    }
    setCloud('synced');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkCloud();
      if (cancelled) return;
      if (!ok) { setCloud('off'); return; }
      cloudOn.current = true;
      const tid = sessionRef.current?.tenantId;
      if (tid) await pull(tid);
      else setCloud('synced');
    })();
    return () => { cancelled = true; };
  }, [pull]);

  useEffect(() => {
    if (!cloudOn.current || !tenantId) return;
    void pull(tenantId);
  }, [tenantId, pull]);

  useEffect(() => {
    if (!cloudOn.current || !tenantId) return;
    const jp = justPulled.current[tenantId];
    if (jp && Date.now() - jp < 2500) return;
    const t = window.setTimeout(() => {
      setCloud('saving');
      saveTenant(tenantId, dbsRef.current[tenantId])
        .then((ok) => setCloud(ok ? 'synced' : 'error'))
        .catch(() => setCloud('error'));
    }, 1100);
    return () => window.clearTimeout(t);
  }, [dbs, tenantId]);

  const retryCloud = useCallback(() => {
    setCloud('checking');
    void (async () => {
      const ok = await checkCloud();
      if (!ok) { setCloud('off'); return; }
      cloudOn.current = true;
      const tid = sessionRef.current?.tenantId;
      if (tid) await pull(tid);
      else setCloud('synced');
    })();
  }, [pull]);

  /* ---------- helpers ---------- */
  const findAccount = useCallback((email: string): { tenantId: string; user: User } | null => {
    const e = email.trim().toLowerCase();
    for (const [tid, td] of Object.entries(dbsRef.current)) {
      const user = td.users.find((u) => u.email.toLowerCase() === e);
      if (user) return { tenantId: tid, user };
    }
    return null;
  }, []);

  const emailInUse = useCallback((email: string): boolean => findAccount(email) !== null, [findAccount]);

  /* ---------- ações de autenticação ---------- */
  const login = useCallback((email: string, password: string): Result => {
    const acc = findAccount(email);
    if (!acc) return { ok: false, error: 'Nenhuma conta encontrada com este e-mail.' };
    if (acc.user.status !== 'ativo' || !acc.user.passwordHash)
      return { ok: false, error: 'Conta pendente de ativação. Use o código do convite recebido.' };
    if (!verifyPassword(password, acc.user.passwordHash)) return { ok: false, error: 'Senha incorreta. Tente novamente.' };
    setSession({ tenantId: acc.tenantId, userId: acc.user.id, loggedAt: new Date().toISOString() });
    setPage('dashboard');
    return { ok: true };
  }, [findAccount]);

  const logout = useCallback(() => {
    setSession(null);
    setPortalOpen(false);
    setPage('dashboard');
  }, []);

  const register = useCallback((input: RegisterInput): Result => {
    if (input.tenantName.trim().length < 2) return { ok: false, error: 'Informe o nome do estabelecimento.' };
    if (input.ownerName.trim().length < 2) return { ok: false, error: 'Informe seu nome completo.' };
    if (!validEmail(input.ownerEmail)) return { ok: false, error: 'Informe um e-mail válido.' };
    if (emailInUse(input.ownerEmail)) return { ok: false, error: 'Este e-mail já possui uma conta. Faça login.' };
    const pwIssue = passwordIssue(input.ownerPassword);
    if (pwIssue) return { ok: false, error: pwIssue };

    let slug = slugify(input.tenantName);
    while (dbsRef.current[slug]) slug = `${slug}-${Math.floor(Math.random() * 90) + 10}`;

    const owner = createOwner(input.ownerName, input.ownerEmail, hashPassword(input.ownerPassword));
    const tenant = createEmptyTenant({
      name: input.tenantName.trim(),
      slug,
      category: input.category.trim() || 'Serviços',
      phone: input.phone.trim(),
      address: input.address.trim(),
      timezone: input.timezone,
      accent: input.accent,
      owner,
    });
    setDbs((prev) => ({ ...prev, [slug]: tenant }));
    setSession({ tenantId: slug, userId: owner.id, loggedAt: new Date().toISOString() });
    setPage('dashboard');
    return { ok: true };
  }, [emailInUse]);

  const requestReset = useCallback((email: string): Result => {
    const acc = findAccount(email);
    if (!acc || acc.user.status !== 'ativo')
      return { ok: false, error: 'Não encontramos uma conta ativa com este e-mail.' };
    const token: Token = {
      id: uid(), type: 'reset', email: acc.user.email, tenantId: acc.tenantId,
      token: generateToken(), createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };
    setTokens((prev) => [token, ...prev.filter((t) => !(t.type === 'reset' && t.email.toLowerCase() === acc.user.email.toLowerCase()))]);
    return { ok: true, token };
  }, [findAccount]);

  const inviteUser = useCallback((input: InviteInput): Result => {
    const s = sessionRef.current;
    if (!s) return { ok: false, error: 'Sessão expirada. Entre novamente.' };
    if (input.name.trim().length < 2) return { ok: false, error: 'Informe o nome do convidado.' };
    if (!validEmail(input.email)) return { ok: false, error: 'Informe um e-mail válido.' };
    if (emailInUse(input.email)) return { ok: false, error: 'Este e-mail já está em uso na plataforma.' };

    const user: User = {
      id: uid(), name: input.name.trim(), email: input.email.trim().toLowerCase(),
      role: input.role, passwordHash: '', status: 'convidado',
      professionalId: input.role === 'professional' ? input.professionalId : undefined,
    };
    const token: Token = {
      id: uid(), type: 'invite', email: user.email, tenantId: s.tenantId,
      token: generateToken(), createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };
    setDbs((prev) => ({
      ...prev,
      [s.tenantId]: { ...prev[s.tenantId], users: [...prev[s.tenantId].users, user] },
    }));
    setTokens((prev) => [token, ...prev]);
    return { ok: true, token };
  }, [emailInUse]);

  const redeemToken = useCallback((tokenId: string, newPassword: string): Result => {
    const tk = tokens.find((t) => t.id === tokenId);
    if (!tk) return { ok: false, error: 'Código inválido ou já utilizado.' };
    if (new Date(tk.expiresAt).getTime() < Date.now())
      return { ok: false, error: 'Este código expirou. Solicite um novo.' };
    const pwIssue = passwordIssue(newPassword);
    if (pwIssue) return { ok: false, error: pwIssue };
    const hash = hashPassword(newPassword);

    setDbs((prev) => {
      const td = prev[tk.tenantId];
      if (!td) return prev;
      return {
        ...prev,
        [tk.tenantId]: {
          ...td,
          users: td.users.map((u) =>
            u.email.toLowerCase() === tk.email.toLowerCase()
              ? { ...u, passwordHash: hash, status: 'ativo' as const }
              : u,
          ),
        },
      };
    });
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    return { ok: true };
  }, [tokens]);

  const changePassword = useCallback((oldPw: string, newPw: string): Result => {
    const s = sessionRef.current;
    if (!s) return { ok: false, error: 'Sessão expirada.' };
    const me = dbsRef.current[s.tenantId]?.users.find((u) => u.id === s.userId);
    if (!me) return { ok: false, error: 'Conta não encontrada.' };
    if (!verifyPassword(oldPw, me.passwordHash)) return { ok: false, error: 'Senha atual incorreta.' };
    const pwIssue = passwordIssue(newPw);
    if (pwIssue) return { ok: false, error: pwIssue };
    const hash = hashPassword(newPw);
    setDbs((prev) => ({
      ...prev,
      [s.tenantId]: { ...prev[s.tenantId], users: prev[s.tenantId].users.map((u) => (u.id === s.userId ? { ...u, passwordHash: hash } : u)) },
    }));
    return { ok: true };
  }, []);

  const setUserRole = useCallback((userId: string, newRole: Role): Result => {
    const s = sessionRef.current;
    if (!s) return { ok: false, error: 'Sessão expirada.' };
    const td = dbsRef.current[s.tenantId];
    if (!td) return { ok: false, error: 'Tenant não encontrado.' };
    const target = td.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Usuário não encontrado.' };
    const owners = td.users.filter((u) => u.role === 'owner' && u.status === 'ativo');
    if (target.role === 'owner' && newRole !== 'owner' && owners.length <= 1)
      return { ok: false, error: 'O estabelecimento precisa de pelo menos um proprietário ativo.' };
    setDbs((prev) => ({
      ...prev,
      [s.tenantId]: { ...prev[s.tenantId], users: prev[s.tenantId].users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)) },
    }));
    return { ok: true };
  }, []);

  const removeUser = useCallback((userId: string): Result => {
    const s = sessionRef.current;
    if (!s) return { ok: false, error: 'Sessão expirada.' };
    if (userId === s.userId) return { ok: false, error: 'Você não pode remover a própria conta.' };
    const td = dbsRef.current[s.tenantId];
    if (!td) return { ok: false, error: 'Tenant não encontrado.' };
    const target = td.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Usuário não encontrado.' };
    const owners = td.users.filter((u) => u.role === 'owner' && u.status === 'ativo');
    if (target.role === 'owner' && owners.length <= 1)
      return { ok: false, error: 'O estabelecimento precisa de pelo menos um proprietário ativo.' };
    setDbs((prev) => ({
      ...prev,
      [s.tenantId]: { ...prev[s.tenantId], users: prev[s.tenantId].users.filter((u) => u.id !== userId) },
    }));
    return { ok: true };
  }, []);

  const mutate = useCallback((fn: (d: TenantData) => TenantData) => {
    const s = sessionRef.current;
    if (!s) return;
    setDbs((prev) => (prev[s.tenantId] ? { ...prev, [s.tenantId]: fn(prev[s.tenantId]) } : prev));
  }, []);

  const value: StoreCtx = {
    session, tenantId, data, currentUser, role: role_, mutate,
    page, nav: setPage, intent, setIntent, portalOpen, setPortalOpen,
    tokens, login, logout, register, requestReset, inviteUser, redeemToken,
    changePassword, setUserRole, removeUser,
    cloud, retryCloud,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do StoreProvider');
  return ctx;
}
