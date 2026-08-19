export type Role = 'owner' | 'manager' | 'receptionist' | 'professional';

export type AppointmentStatus = 'pendente' | 'confirmado' | 'concluido' | 'cancelado' | 'no_show';

export type DayHours = {
  closed: boolean;
  start: string;
  end: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

/** 0 = Domingo … 6 = Sábado */
export type WeeklyHours = Record<number, DayHours>;

export type TenantSettings = {
  name: string;
  slug: string;
  category: string;
  phone: string;
  address: string;
  timezone: string;
  accent: string;
  logoUrl: string | null;
  defaultHours: WeeklyHours;
  templates: {
    confirmacao: string;
    lembrete24: string;
    lembrete2: string;
    cancelamento: string;
  };
  reminders: { h24: boolean; h2: boolean };
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** hash bcrypt — nunca texto puro. Vazio enquanto o convite não é aceito. */
  passwordHash: string;
  status: 'ativo' | 'convidado';
  professionalId?: string;
};

export type Professional = {
  id: string;
  name: string;
  occupation: string;
  bio: string;
  color: string;
  commission: number;
  active: boolean;
  avatarUrl: string | null;
  weeklyHours: WeeklyHours;
};

export type ServiceCategory = { id: string; name: string; description: string };

export type Service = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  color: string;
  active: boolean;
  bufferBefore: number;
  bufferAfter: number;
  maxPerDay: number;
  professionalIds: string[];
  imageUrl: string | null;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  active: boolean;
  imageUrl: string | null;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthdate: string;
  notes: string;
  tags: string[];
  createdAt: string;
};

export type Appointment = {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  startMin: number;
  endMin: number;
  status: AppointmentStatus;
  price: number;
  paymentMethodId: string | null;
  notes: string;
  origin: 'interno' | 'online';
  createdAt: string;
};

export type BlockedTime = {
  id: string;
  groupId: string | null;
  professionalId: string | null;
  serviceId: string | null;
  date: string;
  startMin: number;
  endMin: number;
  reason: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
  type: 'dinheiro' | 'pix' | 'cartao' | 'transferencia';
  active: boolean;
};

export type PaymentRecord = {
  id: string;
  appointmentId: string;
  methodId: string;
  amount: number;
  date: string;
  status: 'pago' | 'pendente';
};

export type NotificationKind = 'confirmacao' | 'lembrete24' | 'lembrete2' | 'cancelamento' | 'novo_online';

export type NotificationEntry = {
  id: string;
  to: string;
  phone: string;
  kind: NotificationKind;
  message: string;
  status: 'enviada' | 'falhou';
  at: string;
};

export type TenantData = {
  settings: TenantSettings;
  users: User[];
  professionals: Professional[];
  categories: ServiceCategory[];
  services: Service[];
  products: Product[];
  clients: Client[];
  appointments: Appointment[];
  blocks: BlockedTime[];
  paymentMethods: PaymentMethod[];
  payments: PaymentRecord[];
  notifications: NotificationEntry[];
};

export type PageId =
  | 'dashboard' | 'agenda' | 'blocks'
  | 'services' | 'clients' | 'professionals'
  | 'hours' | 'payments' | 'notifications' | 'settings';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Proprietário(a)',
  manager: 'Gerente',
  receptionist: 'Recepção',
  professional: 'Profissional',
};

export const ACCESS: Record<Role, PageId[]> = {
  owner: ['dashboard', 'agenda', 'blocks', 'services', 'clients', 'professionals', 'hours', 'payments', 'notifications', 'settings'],
  manager: ['dashboard', 'agenda', 'blocks', 'services', 'clients', 'professionals', 'hours', 'payments', 'notifications'],
  receptionist: ['dashboard', 'agenda', 'clients', 'services', 'payments'],
  professional: ['dashboard', 'agenda'],
};

/* ---------- autenticação ---------- */

export type Session = {
  tenantId: string;
  userId: string;
  loggedAt: string;
};

export type TokenType = 'invite' | 'reset';

export type Token = {
  id: string;
  type: TokenType;
  email: string;
  tenantId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};
