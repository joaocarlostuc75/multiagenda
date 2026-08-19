import { useMemo, useState } from 'react';
import type { Client } from '../types';
import { useApp } from '../store';
import { fmtBRL, fmtShortDow, minToTime, todayISO, uid } from '../lib/schedule';
import {
  Avatar, Badge, Btn, Confirm, EmptyState, Field, Icon, Modal, PageHead, StatusBadge,
  TextArea, TextInput, useToast,
} from '../components/ui';

function ClientModal({ initial, onClose }: { initial: Client | null; onClose: () => void }) {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const [form, setForm] = useState<Client>(initial ?? {
    id: uid(), name: '', phone: '', email: '', birthdate: '', notes: '', tags: [], createdAt: new Date().toISOString(),
  });
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [err, setErr] = useState('');

  const save = () => {
    if (form.name.trim().length < 2) { setErr('Informe o nome completo.'); return; }
    if (form.phone.trim().length < 8) { setErr('Informe um WhatsApp/telefone válido (com DDD).'); return; }
    const dup = data.clients.find((c) => c.phone.trim() === form.phone.trim() && c.id !== form.id);
    if (dup) { setErr(`Já existe um cliente com este telefone: ${dup.name}.`); return; }
    const tags = tagsText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const final = { ...form, name: form.name.trim(), phone: form.phone.trim(), tags: [...new Set(tags)] };
    mutate((d) => {
      const exists = d.clients.some((c) => c.id === final.id);
      return { ...d, clients: exists ? d.clients.map((c) => (c.id === final.id ? final : c)) : [...d.clients, final] };
    });
    push(initial ? 'Cliente atualizado.' : `Cliente “${final.name}” cadastrado.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Editar cliente' : 'Novo cliente'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="check" onClick={save}>{initial ? 'Salvar' : 'Cadastrar'}</Btn></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nome completo" req className="sm:col-span-2">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maria da Silva" />
        </Field>
        <Field label="WhatsApp / telefone" req>
          <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
        </Field>
        <Field label="E-mail">
          <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Data de nascimento">
          <TextInput type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
        </Field>
        <Field label="Tags" hint="separe por vírgula">
          <TextInput value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="vip, recorrente" />
        </Field>
        <Field label="Observações (LGPD: uso interno)" className="sm:col-span-2">
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Alergias, preferências, restrições…" />
        </Field>
      </div>
      {err && <p className="anim-drawIn mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-danger"><Icon name="alert" size={13} />{err}</p>}
    </Modal>
  );
}

export function ClientsPage() {
  const { data, mutate, role } = useApp();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [detail, setDetail] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);

  const canEdit = role !== 'professional';

  const spend = useMemo(() => {
    const m = new Map<string, { total: number; visits: number; last: string }>();
    for (const a of data.appointments) {
      const cur = m.get(a.clientId) ?? { total: 0, visits: 0, last: '' };
      if (a.status === 'concluido') cur.total += a.price;
      if (a.status !== 'cancelado') { cur.visits += 1; if (a.date > cur.last) cur.last = a.date; }
      m.set(a.clientId, cur);
    }
    return m;
  }, [data.appointments]);

  const allTags = useMemo(() => [...new Set(data.clients.flatMap((c) => c.tags))].sort(), [data.clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.clients]
      .filter((c) => !tagFilter || c.tags.includes(tagFilter))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.clients, query, tagFilter]);

  const exportCsv = () => {
    const rows = [
      ['Nome', 'Telefone', 'E-mail', 'Tags', 'Visitas', 'Total gasto'],
      ...filtered.map((c) => {
        const s = spend.get(c.id);
        return [c.name, c.phone, c.email, c.tags.join('; '), String(s?.visits ?? 0), (s?.total ?? 0).toFixed(2)];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push(`${filtered.length} clientes exportados em CSV.`);
  };

  const detailHistory = detail
    ? data.appointments.filter((a) => a.clientId === detail.id).sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin)
    : [];

  return (
    <div>
      <PageHead title="Clientes" desc={`${data.clients.length} cadastrados · busca por nome, telefone ou e-mail`}>
        <Btn variant="outline" icon="download" onClick={exportCsv}>Exportar CSV</Btn>
        {canEdit && <Btn icon="plus" onClick={() => setModal({ open: true, client: null })}>Novo cliente</Btn>}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <TextInput placeholder="Buscar cliente…" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-9" />
        </div>
        {allTags.map((t) => (
          <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold capitalize transition-all ${tagFilter === t ? 'border-transparent bg-pine text-white' : 'border-line bg-card text-inksoft hover:border-inkfaint'}`}>
            #{t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="users" title={query || tagFilter ? 'Nenhum resultado' : 'Nenhum cliente ainda'}
          desc={query || tagFilter ? 'Ajuste a busca ou remova filtros para ver mais resultados.' : 'Cadastre o primeiro cliente ou receba agendamentos pelo portal online.'}>
          {canEdit && !query && !tagFilter && <Btn icon="plus" onClick={() => setModal({ open: true, client: null })}>Cadastrar cliente</Btn>}
        </EmptyState>
      ) : (
        <div className="anim-fadeUp overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-inkfaint">
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-3 py-3 font-bold">Contato</th>
                <th className="px-3 py-3 font-bold">Tags</th>
                <th className="px-3 py-3 font-bold">Visitas</th>
                <th className="px-3 py-3 font-bold">Total gasto</th>
                <th className="px-3 py-3 font-bold">Última visita</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = spend.get(c.id);
                return (
                  <tr key={c.id} onClick={() => setDetail(c)}
                    className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-mosssoft/25">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size={34} color="#3e8e9e" />
                        <div>
                          <p className="font-bold text-ink">{c.name}</p>
                          {c.birthdate && <p className="text-[11px] text-inkfaint">nasc. {c.birthdate.split('-').reverse().join('/')}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="tnum font-semibold text-ink">{c.phone}</p>
                      <p className="truncate text-[11.5px] text-inksoft">{c.email || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {c.tags.length ? c.tags.map((t) => <Badge key={t} tone="steel" className="capitalize">#{t}</Badge>) : <span className="text-inkfaint">—</span>}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5 font-semibold">{s?.visits ?? 0}</td>
                    <td className="tnum px-3 py-2.5 font-display font-bold">{fmtBRL(s?.total ?? 0)}</td>
                    <td className="tnum px-3 py-2.5 text-inksoft">{s?.last ? fmtShortDow(s.last) : '—'}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setModal({ open: true, client: c })} className="rounded-md p-1.5 text-inksoft hover:bg-ink/5 hover:text-ink" aria-label="Editar"><Icon name="edit" size={15} /></button>
                          <button onClick={() => setToDelete(c)} className="rounded-md p-1.5 text-inksoft hover:bg-dangersoft hover:text-danger" aria-label="Excluir"><Icon name="trash" size={15} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && <ClientModal initial={modal.client} onClose={() => setModal({ open: false, client: null })} />}

      {/* detalhe do cliente */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} w="max-w-xl" title={detail.name}
          subtitle={`${detail.phone}${detail.email ? ` · ${detail.email}` : ''}`}>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { l: 'Visitas', v: String(spend.get(detail.id)?.visits ?? 0) },
              { l: 'Total gasto', v: fmtBRL(spend.get(detail.id)?.total ?? 0) },
              { l: 'Última visita', v: spend.get(detail.id)?.last ? fmtShortDow(spend.get(detail.id)!.last) : '—' },
            ].map((k) => (
              <div key={k.l} className="rounded-lg border border-line bg-paper/60 px-3 py-2.5 text-center">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{k.l}</p>
                <p className="tnum mt-0.5 font-display text-[15px] font-bold text-ink">{k.v}</p>
              </div>
            ))}
          </div>

          <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-inksoft">
            <Icon name="history" size={13} /> Histórico de agendamentos
          </h4>
          {detailHistory.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-paper/50 px-3 py-5 text-center text-[13px] text-inkfaint">
              Nenhum agendamento registrado para este cliente.
            </p>
          ) : (
            <ul className="dark-scroll max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {detailHistory.map((a) => {
                const svc = data.services.find((s) => s.id === a.serviceId);
                const pro = data.professionals.find((p) => p.id === a.professionalId);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                    <div className="tnum w-[92px] shrink-0 text-[12px] font-bold text-ink">
                      {fmtShortDow(a.date)}<span className="block text-[10.5px] font-semibold text-inkfaint">{minToTime(a.startMin)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink">{svc?.name ?? 'Serviço removido'}</p>
                      <p className="truncate text-[11px] text-inksoft">{pro?.name} · {fmtBRL(a.price)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                );
              })}
            </ul>
          )}

          {detail.notes && (
            <p className="mt-4 rounded-lg bg-ambersoft px-3 py-2 text-[12.5px] font-medium text-[#7a5410]">
              <strong>Observações:</strong> {detail.notes}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            {canEdit && (
              <>
                <Btn variant="dangerSoft" icon="trash" onClick={() => { setToDelete(detail); setDetail(null); }}>Excluir</Btn>
                <Btn icon="edit" onClick={() => { setModal({ open: true, client: detail }); setDetail(null); }}>Editar dados</Btn>
              </>
            )}
          </div>
        </Modal>
      )}

      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir cliente (LGPD)"
        desc={`Excluir “${toDelete?.name}” e todos os seus agendamentos? Esta ação atende ao direito de eliminação de dados (LGPD) e não pode ser desfeita.`}
        onConfirm={() => {
          if (!toDelete) return;
          mutate((d) => ({
            ...d,
            clients: d.clients.filter((c) => c.id !== toDelete.id),
            appointments: d.appointments.filter((a) => a.clientId !== toDelete.id),
          }));
          push('Dados do cliente eliminados conforme LGPD.');
        }} />
    </div>
  );
}
