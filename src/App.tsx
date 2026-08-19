import { useEffect } from 'react';
import { StoreProvider, useApp } from './store';
import { ToastProvider } from './components/ui';
import { Shell } from './components/Shell';
import { Outbox } from './components/Outbox';
import { ACCESS } from './types';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { AgendaPage } from './pages/Agenda';
import { ServicesPage } from './pages/Services';
import { ClientsPage } from './pages/Clients';
import { ProfessionalsPage } from './pages/Professionals';
import { HoursPage } from './pages/Hours';
import { BlocksPage } from './pages/Blocks';
import { PaymentsPage } from './pages/Payments';
import { NotificationsPage } from './pages/Notifications';
import { SettingsPage } from './pages/Settings';
import { PortalPage } from './pages/Portal';

function Router() {
  const { page, role, nav, portalOpen } = useApp();

  useEffect(() => {
    if (!ACCESS[role].includes(page)) nav('dashboard');
  }, [role, page, nav]);

  return (
    <>
      <Shell>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'agenda' && <AgendaPage />}
        {page === 'services' && <ServicesPage />}
        {page === 'clients' && <ClientsPage />}
        {page === 'professionals' && <ProfessionalsPage />}
        {page === 'hours' && <HoursPage />}
        {page === 'blocks' && <BlocksPage />}
        {page === 'payments' && <PaymentsPage />}
        {page === 'notifications' && <NotificationsPage />}
        {page === 'settings' && <SettingsPage />}
      </Shell>
      {portalOpen && <PortalPage />}
    </>
  );
}

function Gate() {
  const { session } = useApp();
  if (!session) return <AuthPage />;
  return <Router />;
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Gate />
        <Outbox />
      </ToastProvider>
    </StoreProvider>
  );
}
