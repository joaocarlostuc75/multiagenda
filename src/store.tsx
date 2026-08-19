import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PageId, Role, TenantData, User } from './types';
import { buildTenants } from './data/seed';
import { todayISO } from './lib/schedule';

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
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dbs, setDbs] = useState<Record<string, TenantData>>(loadInitial);
  const [tenantId, setTenantId] = useState('aurora');
  const [role, setRole] = useState<Role>('owner');
  const [page, setPage] = useState<PageId>('dashboard');
  const [intent, setIntent] = useState<Intent>(null);
  const [portalOpen, setPortalOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(dbs)); } catch { /* quota */ }
  }, [dbs]);

  const data = dbs[tenantId];

  const mutate = useCallback((fn: (d: TenantData) => TenantData) => {
    setDbs((prev) => ({ ...prev, [tenantId]: fn(prev[tenantId]) }));
  }, [tenantId]);

  const resetTenant = useCallback(() => {
    setDbs((prev) => ({ ...prev, [tenantId]: buildTenants()[tenantId] }));
  }, [tenantId]);

  const currentUser = useMemo(() => {
    const match = data.users.find((u) => u.role === role);
    return match ?? data.users[0];
  }, [data.users, role]);

  const value: StoreCtx = {
    tenantId, setTenantId, data, mutate, role, setRole, currentUser,
    page, nav: setPage, intent, setIntent, portalOpen, setPortalOpen, resetTenant,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do StoreProvider');
  return ctx;
}
