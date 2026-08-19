import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PageId, Role, TenantData, User } from './types';
import { buildTenants } from './data/seed';
import { todayISO } from './lib/schedule';
import { checkCloud, loadTenant, saveTenant } from './lib/cloudSync';

const KEY = 'agendou:v1';

function loadInitial(): Record<string, TenantData> {
  const fresh = buildTenants();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Record<string, TenantData>;
    const out: Record<string, TenantData> = {};
    for (const id of Object.keys(fresh)) {
      out[id] = parsed[id] && parsed[id].seededOn === todayISO() ? parsed[id] : fresh[id];
    }
    return out;
  } catch {
    return fresh;
  }
}

export type CloudStatus = 'checking' | 'off' | 'saving' | 'synced' | 'error';
export type Intent = { kind: 'new-appointment' } | null;

type StoreCtx = {
  tenantId: string;
  setTenantId: (id: string) => void;
  data: TenantData;
  mutate: (fn: (d: TenantData) => TenantData) => void;
  role: Role;
  setRole: (r: Role) => void;
  currentUser: User;
  page: PageId;
  nav: (p: PageId) => void;
  intent: Intent;
  setIntent: (i: Intent) => void;
  portalOpen: boolean;
  setPortalOpen: (b: boolean) => void;
  resetTenant: () => void;
  cloud: CloudStatus;
  retryCloud: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dbs, setDbs] = useState<Record<string, TenantData>>(loadInitial);
  const [tenantId, setTenantId] = useState('aurora');
  const [role, setRole] = useState<Role>('owner');
  const [page, setPage] = useState<PageId>('dashboard');
  const [intent, setIntent] = useState<Intent>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>('checking');

  const dbsRef = useRef(dbs);
  dbsRef.current = dbs;
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;
  const cloudOn = useRef(false);
  const booted = useRef(false);
  const justPulled = useRef<Record<string, number>>({});

  /* pull de um tenant na nuvem (ou upload do seed local, na primeira vez) */
  const pull = useCallback(async (tid: string) => {
    const remote = await loadTenant(tid);
    if (remote.data) {
      justPulled.current[tid] = Date.now();
      setDbs((prev) => ({ ...prev, [tid]: remote.data as TenantData }));
    } else {
      void saveTenant(tid, dbsRef.current[tid]).catch(() => undefined);
    }
    setCloud('synced');
  }, []);

  /* bootstrap: health check + pull do tenant ativo */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkCloud();
      if (cancelled) return;
      if (!ok) { setCloud('off'); booted.current = true; return; }
      cloudOn.current = true;
      booted.current = true;
      await pull(tenantIdRef.current);
    })();
    return () => { cancelled = true; };
  }, [pull]);

  /* troca de tenant → pull dos dados isolados daquele tenant */
  useEffect(() => {
    if (!booted.current || !cloudOn.current) return;
    void pull(tenantId);
  }, [tenantId, pull]);

  /* persistência: localStorage sempre + push com debounce para o Neon */
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(dbs)); } catch { /* quota */ }
    if (!cloudOn.current) return;
    const tid = tenantId;
    const jp = justPulled.current[tid];
    if (jp && Date.now() - jp < 2500) return; // eco do pull, não re-enviar
    const t = window.setTimeout(() => {
      setCloud('saving');
      saveTenant(tid, dbsRef.current[tid])
        .then((ok) => setCloud(ok ? 'synced' : 'error'))
        .catch(() => setCloud('error'));
    }, 1100);
    return () => window.clearTimeout(t);
  }, [dbs, tenantId]);

  const mutate = useCallback((fn: (d: TenantData) => TenantData) => {
    setDbs((prev) => ({ ...prev, [tenantId]: fn(prev[tenantId]) }));
  }, [tenantId]);

  const resetTenant = useCallback(() => {
    setDbs((prev) => ({ ...prev, [tenantId]: buildTenants()[tenantId] }));
  }, [tenantId]);

  const retryCloud = useCallback(() => {
    setCloud('checking');
    void (async () => {
      const ok = await checkCloud();
      if (!ok) { setCloud('off'); return; }
      cloudOn.current = true;
      await pull(tenantIdRef.current);
    })();
  }, [pull]);

  const data = dbs[tenantId];

  const currentUser = useMemo(() => {
    const match = data.users.find((u) => u.role === role);
    return match ?? data.users[0];
  }, [data.users, role]);

  const value: StoreCtx = {
    tenantId, setTenantId, data, mutate, role, setRole, currentUser,
    page, nav: setPage, intent, setIntent, portalOpen, setPortalOpen,
    resetTenant, cloud, retryCloud,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do StoreProvider');
  return ctx;
}
