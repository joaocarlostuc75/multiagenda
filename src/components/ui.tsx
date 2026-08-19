import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { AppointmentStatus } from '../types';

/* ================= ícones (SVG inline) ================= */

const P: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="12" width="7.5" height="9" rx="1.5" /><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M8.5 14.5l2.5 2.5 4.5-5" /></>,
  calendarBig: <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.8 14.9c1.9.8 3.2 2.4 3.7 5.1" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
  scissors: <><circle cx="6" cy="6.5" r="2.8" /><circle cx="6" cy="17.5" r="2.8" /><path d="M8.4 8.2L20.5 19M8.4 15.8L20.5 5M13.2 12.5l1.6 1.4" /></>,
  spark: <><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z" /><path d="M19 16l.9 2.6L22.5 19.5l-2.6.9L19 23l-.9-2.6-2.6-.9 2.6-.9z" /></>,
  tag: <><path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H11l9.4 9.4a2 2 0 0 1 0 2.8l-5.2 5.2a2 2 0 0 1-2.8 0z" /><circle cx="8" cy="8" r="1.6" /></>,
  box: <><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></>,
  wallet: <><path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h11.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17z" /><path d="M15 4.5V7M3.5 9.5h16.5v4H16a2 2 0 0 1 0-4" /></>,
  bell: <><path d="M6 9.5a6 6 0 0 1 12 0c0 5 1.8 6.3 1.8 6.3H4.2S6 14.5 6 9.5" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8l1.2 2.6 2.8-.7 1.4 2.5 2.9.4-.3 2.9 2.2 1.9-1.5 2.5 1.5 2.5-2.2 1.9.3 2.9-2.9.4-1.4 2.5-2.8-.7L12 21.2l-1.2-2.6-2.8.7-1.4-2.5-2.9-.4.3-2.9L1.8 12l1.5-2.5-1.5-2.5 2.2-1.9-.3-2.9 2.9-.4 1.4-2.5 2.8.7z" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  chevL: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevR: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  chevD: <path d="M5.5 9.5L12 16l6.5-6.5" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  x: <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  trash: <><path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6 6.5l.8 13A2 2 0 0 0 8.8 21.5h6.4a2 2 0 0 0 2-1.9l.8-13.1" /><path d="M10 10.5v7M14 10.5v7" /></>,
  edit: <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z" /><path d="M14.5 8l1.5 1.5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  chat: <><path d="M21 11.8a8.4 8.4 0 0 1-12.2 7.5L3 21l1.8-5.6A8.4 8.4 0 1 1 21 11.8z" /><path d="M8.5 10.5h7M8.5 13.8h4.5" /></>,
  download: <><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5" /><path d="M4 16.5v2A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-2" /></>,
  upload: <><path d="M12 14.5v-11M7.5 7.5L12 3l4.5 4.5" /><path d="M4 16.5v2A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-2" /></>,
  alert: <><path d="M12 3.5L1.8 20.5h20.4z" /><path d="M12 9.5v5M12 17.6v.4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.8V17M12 7.2v.4" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  mail: <><rect x="3" y="5" width="18" height="14.5" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  phone: <path d="M5.5 3.5h4l1.5 5-2.5 1.8a12.5 12.5 0 0 0 6.2 6.2L16.5 14l5 1.5v4a2 2 0 0 1-2.2 2A17.3 17.3 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2z" />,
  pin: <><path d="M12 21.5s7.5-6.6 7.5-11.9a7.5 7.5 0 0 0-15 0c0 5.3 7.5 11.9 7.5 11.9z" /><circle cx="12" cy="9.5" r="2.7" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 2.5v4.5H16" /></>,
  star: <path d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.6l6.1-.9z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" /></>,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  arrowL: <path d="M20 12H4M10.5 5.5L4 12l6.5 6.5" />,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  percent: <><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="17" r="2.6" /></>,
  send: <><path d="M21.5 2.5L10.8 13.2" /><path d="M21.5 2.5L14.5 21.5l-3.7-8.3-8.3-3.7z" /></>,
  zap: <path d="M13 2.5L4.5 13.5H11L9.5 21.5 19.5 9.5H12.5z" />,
  history: <><path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" /><path d="M3.5 13.5V18H8" /><path d="M12 7.5V12l3 2" /></>,
};

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {P[name] ?? P.info}
    </svg>
  );
}

/* ================= botões ================= */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'soft' | 'dangerSoft';
  size?: 'sm' | 'md';
  icon?: string;
};

export function Btn({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }: BtnProps) {
  const v = {
    primary: 'bg-moss text-white hover:bg-mossdark shadow-sm',
    outline: 'border border-line bg-card text-ink hover:border-inkfaint hover:bg-white',
    ghost: 'text-inksoft hover:text-ink hover:bg-ink/5',
    soft: 'bg-mosssoft text-mossdark hover:bg-[#d3e7de]',
    danger: 'bg-danger text-white hover:bg-[#a33b2d] shadow-sm',
    dangerSoft: 'bg-dangersoft text-danger hover:bg-[#f0d5cf]',
  }[variant];
  const s = size === 'sm' ? 'px-2.5 py-1.5 text-[13px] gap-1.5' : 'px-3.5 py-2 text-sm gap-2';
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none ${v} ${s} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  );
}

/* ================= formulários ================= */

export const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-inkfaint transition-colors focus:border-moss';

export function Field({ label, error, hint, req, children, className = '' }: {
  label: string; error?: string | null; hint?: string; req?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-semibold text-inksoft">
        <span>{label}{req && <span className="ml-0.5 text-danger">*</span>}</span>
        {hint && <span className="font-normal text-inkfaint">{hint}</span>}
      </span>
      {children}
      {error && <span className="anim-drawIn mt-1 flex items-center gap-1 text-[12px] font-medium text-danger"><Icon name="alert" size={12} />{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} cursor-pointer ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[84px] resize-y ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 disabled:opacity-40 ${label ? '' : ''}`}>
      <span className={`relative h-[22px] w-[40px] rounded-full transition-colors duration-200 ${checked ? 'bg-moss' : 'bg-ink/20'}`}>
        <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[21px]' : 'left-[3px]'}`} />
      </span>
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
    </button>
  );
}

export function Seg<T extends string>({ options, value, onChange, className = '' }: {
  options: { value: T; label: string; icon?: string }[];
  value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={`inline-flex rounded-lg border border-line bg-paper p-0.5 ${className}`}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 ${value === o.value ? 'bg-pine text-white shadow-sm' : 'text-inksoft hover:text-ink'}`}>
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ================= badges & status ================= */

export type Tone = 'amber' | 'moss' | 'slate' | 'danger' | 'plum' | 'steel' | 'pine';

const TONE_CLS: Record<Tone, string> = {
  amber: 'bg-ambersoft text-amber border-amber/25',
  moss: 'bg-mosssoft text-mossdark border-moss/25',
  slate: 'bg-slatesoft text-slatey border-slatey/25',
  danger: 'bg-dangersoft text-danger border-danger/25',
  plum: 'bg-plumsoft text-plum border-plum/25',
  steel: 'bg-steelsoft text-steel border-steel/25',
  pine: 'bg-pine text-mint border-pine3',
};

export function Badge({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-bold ${TONE_CLS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const STATUS_META: Record<AppointmentStatus, { label: string; tone: Tone; dot: string; blockCls: string }> = {
  pendente: { label: 'Pendente', tone: 'amber', dot: '#c07a17', blockCls: 'bg-ambersoft border-l-amber text-[#7a5410]' },
  confirmado: { label: 'Confirmado', tone: 'moss', dot: '#157f63', blockCls: 'bg-mosssoft border-l-moss text-[#0d503d]' },
  concluido: { label: 'Concluído', tone: 'slate', dot: '#55605a', blockCls: 'bg-slatesoft border-l-slatey text-slatey' },
  cancelado: { label: 'Cancelado', tone: 'danger', dot: '#bb4636', blockCls: 'bg-dangersoft border-l-danger text-danger line-through' },
  no_show: { label: 'Não compareceu', tone: 'plum', dot: '#6e4b7e', blockCls: 'bg-plumsoft border-l-plum text-plum' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </Badge>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />;
}

/* ================= avatar ================= */

export function Avatar({ name, url, color = '#157f63', size = 34, className = '' }: {
  name: string; url?: string | null; color?: string; size?: number; className?: string;
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return url ? (
    <img src={url} alt={name} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

/* ================= modal ================= */

export function Modal({ open, onClose, title, subtitle, children, footer, w = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; footer?: ReactNode; w?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="anim-fadeIn fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pine/55 p-4 pt-[7vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`anim-scaleIn w-full ${w} rounded-xl border border-line bg-card shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[17px] font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-inksoft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-inksoft transition-colors hover:bg-ink/5 hover:text-ink" aria-label="Fechar">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, desc, confirmLabel = 'Excluir', danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; desc: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} w="max-w-md"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Voltar</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
        </>
      }>
      <p className="text-sm leading-relaxed text-inksoft">{desc}</p>
    </Modal>
  );
}

/* ================= vazio ================= */

export function EmptyState({ icon, title, desc, children }: { icon: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="anim-fadeUp flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card/60 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-paper text-inkfaint">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-inksoft">{desc}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* ================= upload de imagem ================= */

export function ImageUpload({ value, onChange, label, hint = 'JPEG, PNG ou WebP · máx. 5 MB' }: {
  value: string | null; onChange: (url: string | null) => void; label: string; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      push('Formato inválido — envie JPEG, PNG ou WebP.', 'err');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      push('Imagem acima de 5 MB. Reduza o tamanho e tente de novo.', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL('image/jpeg', 0.85));
        push('Imagem carregada com sucesso.', 'ok');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-inksoft">{label}</span>
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-paper text-inkfaint">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Icon name="upload" size={20} />}
        </span>
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" icon="upload" onClick={() => ref.current?.click()}>
              {value ? 'Substituir' : 'Enviar imagem'}
            </Btn>
            {value && (
              <Btn variant="dangerSoft" size="sm" icon="trash" onClick={() => onChange(null)}>Remover</Btn>
            )}
          </div>
          <span className="text-[11.5px] text-inkfaint">{hint}</span>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

/* ================= toasts ================= */

type ToastKind = 'ok' | 'err' | 'info';
type ToastItem = { id: number; msg: string; kind: ToastKind };

const ToastCtx = createContext<{ push: (msg: string, kind?: ToastKind) => void }>({ push: () => {} });

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = (msg: string, kind: ToastKind = 'ok') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id}
            className={`anim-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur ${
              t.kind === 'ok' ? 'border-moss/30 bg-[#0f2b22]/95 text-[#d9efe6]'
              : t.kind === 'err' ? 'border-danger/40 bg-[#331511]/95 text-[#f6dcd7]'
              : 'border-line bg-pine/95 text-paper'}`}>
            <span className={`mt-0.5 ${t.kind === 'ok' ? 'text-mint' : t.kind === 'err' ? 'text-[#f0a196]' : 'text-mint'}`}>
              <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'err' ? 'alert' : 'info'} size={16} />
            </span>
            <p className="flex-1 text-[13px] font-medium leading-snug">{t.msg}</p>
            <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))} className="opacity-60 transition-opacity hover:opacity-100">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ================= cabeçalho de página ================= */

export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        {desc && <p className="mt-0.5 text-[13.5px] text-inksoft">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
