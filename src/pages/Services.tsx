import { useMemo, useState } from 'react';
import type { Product, Service, ServiceCategory } from '../types';
import { useApp } from '../store';
import { fmtBRL, uid } from '../lib/schedule';
import {
  Badge, Btn, Confirm, Dot, EmptyState, Field, Icon, ImageUpload, Modal, PageHead,
  Select, TextArea, TextInput, Toggle, useToast,
} from '../components/ui';

const PALETTE = ['#c25e7c', '#a34a6d', '#3e8e9e', '#c98a2d', '#7a9a4e', '#5b7db1', '#3a678f', '#6e4b7e', '#8a5a44', '#157f63'];

/* ============ modal serviço ============ */

function ServiceModal({ initial, onClose }: { initial: Service | null; onClose: () => void }) {
  const { data, mutate } = useApp();
  const { push } = useToast();
  const [form, setForm] = useState<Service>(initial ?? {
    id: uid(), categoryId: data.categories[0]?.id ?? '', name: '', description: '',
    durationMin: 60, price: 100, color: PALETTE[0], active: true,
    bufferBefore: 0, bufferAfter: 0, maxPerDay: 0, professionalIds: [], imageUrl: null,
  });
  const [err, setErr] = useState('');

  const set = <K extends keyof Service>(k: K, v: Service[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (form.name.trim().length < 2) { setErr('Informe um nome para o serviço.'); return; }
    if (!form.categoryId) { setErr('Crie uma categoria antes de cadastrar serviços.'); return; }
    if (form.durationMin < 5) { setErr('Duração mínima: 5 minutos.'); return; }
    mutate((d) => {
      const exists = d.services.some((s) => s.id === form.id);
      return { ...d, services: exists ? d.services.map((s) => (s.id === form.id ? form : s)) : [...d.services, form] };
    });
    push(initial ? 'Serviço atualizado.' : `Serviço “${form.name}” criado.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} w="max-w-2xl" title={initial ? 'Editar serviço' : 'Novo serviço'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="check" onClick={save}>{initial ? 'Salvar' : 'Criar serviço'}</Btn></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nome" req className="sm:col-span-2">
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Corte & Escova" />
        </Field>
        <Field label="Categoria" req>
          <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Duração (minutos)" req hint="passos de 15">
          <TextInput type="number" min={5} step={5} value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        </Field>
        <Field label="Preço (R$)" req>
          <TextInput type="number" min={0} step={5} value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
        </Field>
        <Field label="Cor na agenda">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => set('color', c)} aria-label={`Cor ${c}`}
                className={`h-7 w-7 rounded-lg transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </Field>
        <Field label="Buffer antes (min)" hint="preparo">
          <TextInput type="number" min={0} step={5} value={form.bufferBefore} onChange={(e) => set('bufferBefore', Number(e.target.value))} />
        </Field>
        <Field label="Buffer depois (min)" hint="limpeza">
          <TextInput type="number" min={0} step={5} value={form.bufferAfter} onChange={(e) => set('bufferAfter', Number(e.target.value))} />
        </Field>
        <Field label="Limite por dia" hint="0 = ilimitado">
          <TextInput type="number" min={0} value={form.maxPerDay} onChange={(e) => set('maxPerDay', Number(e.target.value))} />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Visível no portal do cliente" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Profissionais habilitados" hint="nenhum marcado = todos">
            <div className="grid gap-1.5 rounded-lg border border-line bg-white p-2.5 sm:grid-cols-2">
              {data.professionals.map((p) => {
                const on = form.professionalIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => set('professionalIds', on ? form.professionalIds.filter((x) => x !== p.id) : [...form.professionalIds, p.id])}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] font-semibold transition-all ${on ? 'border-moss/40 bg-mosssoft text-mossdark' : 'border-line bg-card text-inksoft hover:border-inkfaint'}`}>
                    <Dot color={p.color} size={8} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {on && <Icon name="check" size={14} />}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2"><ImageUpload label="Foto do serviço (1200×800 recomendado)" value={form.imageUrl} onChange={(v) => set('imageUrl', v)} /></div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-paper/70 px-3.5 py-2.5 sm:col-span-2">
          <div>
            <p className="text-[13px] font-bold text-ink">Serviço ativo</p>
            <p className="text-[11.5px] text-inksoft">Inativos não aparecem no portal nem na recepção.</p>
          </div>
          <Toggle checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </div>
      {err && <p className="anim-drawIn mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-danger"><Icon name="alert" size={13} />{err}</p>}
    </Modal>
  );
}

/* ============ modal produto ============ */

function ProductModal({ initial, onClose }: { initial: Product | null; onClose: () => void }) {
  const { mutate } = useApp();
  const { push } = useToast();
  const [form, setForm] = useState<Product>(initial ?? {
    id: uid(), name: '', description: '', price: 0, stock: 0, active: true, imageUrl: null,
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (form.name.trim().length < 2) { setErr('Informe o nome do produto.'); return; }
    mutate((d) => {
      const exists = d.products.some((p) => p.id === form.id);
      return { ...d, products: exists ? d.products.map((p) => (p.id === form.id ? form : p)) : [...d.products, form] };
    });
    push(initial ? 'Produto atualizado.' : `Produto “${form.name}” criado.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Editar produto' : 'Novo produto'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon="check" onClick={save}>{initial ? 'Salvar' : 'Criar produto'}</Btn></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nome" req className="sm:col-span-2"><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Preço (R$)"><TextInput type="number" min={0} step={0.1} value={form.price} onChange={(e) => set('price', Number(e.target.value))} /></Field>
        <Field label="Estoque"><TextInput type="number" min={0} value={form.stock} onChange={(e) => set('stock', Number(e.target.value))} /></Field>
        <Field label="Descrição" className="sm:col-span-2"><TextArea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="sm:col-span-2"><ImageUpload label="Foto do produto (800×800 recomendado)" value={form.imageUrl} onChange={(v) => set('imageUrl', v)} /></div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-paper/70 px-3.5 py-2.5 sm:col-span-2">
          <p className="text-[13px] font-bold text-ink">Produto ativo</p>
          <Toggle checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </div>
      {err && <p className="anim-drawIn mt-3 text-[12.5px] font-bold text-danger">{err}</p>}
    </Modal>
  );
}

/* ============ página ============ */

export function ServicesPage() {
  const { data, mutate, role } = useApp();
  const { push } = useToast();
  const [tab, setTab] = useState<'servicos' | 'produtos'>('servicos');
  const [catSel, setCatSel] = useState<string>('all');
  const [svcModal, setSvcModal] = useState<{ open: boolean; svc: Service | null }>({ open: false, svc: null });
  const [prdModal, setPrdModal] = useState<{ open: boolean; prd: Product | null }>({ open: false, prd: null });
  const [catModal, setCatModal] = useState<{ open: boolean; cat: ServiceCategory | null }>({ open: false, cat: null });
  const [delSvc, setDelSvc] = useState<Service | null>(null);
  const [delPrd, setDelPrd] = useState<Product | null>(null);
  const [delCat, setDelCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const canEdit = role !== 'receptionist';

  const services = useMemo(
    () => data.services.filter((s) => catSel === 'all' || s.categoryId === catSel),
    [data.services, catSel],
  );

  const openCatModal = (cat: ServiceCategory | null) => {
    setCatName(cat?.name ?? '');
    setCatDesc(cat?.description ?? '');
    setCatModal({ open: true, cat });
  };

  const saveCat = () => {
    if (catName.trim().length < 2) { push('Nome da categoria muito curto.', 'err'); return; }
    mutate((d) => {
      if (catModal.cat) {
        return { ...d, categories: d.categories.map((c) => (c.id === catModal.cat!.id ? { ...c, name: catName.trim(), description: catDesc.trim() } : c)) };
      }
      return { ...d, categories: [...d.categories, { id: uid(), name: catName.trim(), description: catDesc.trim() }] };
    });
    push(catModal.cat ? 'Categoria atualizada.' : 'Categoria criada.');
    setCatModal({ open: false, cat: null });
  };

  return (
    <div>
      <PageHead title="Serviços & Produtos" desc="Catálogo completo do estabelecimento — o que aparece no portal do cliente vem daqui.">
        <div className="flex rounded-lg border border-line bg-paper p-0.5">
          {([['servicos', 'Serviços'], ['produtos', 'Produtos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold transition-all ${tab === v ? 'bg-pine text-white shadow-sm' : 'text-inksoft hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        {tab === 'servicos' && canEdit && <Btn icon="plus" onClick={() => setSvcModal({ open: true, svc: null })}>Novo serviço</Btn>}
        {tab === 'produtos' && canEdit && <Btn icon="plus" onClick={() => setPrdModal({ open: true, prd: null })}>Novo produto</Btn>}
      </PageHead>

      {tab === 'servicos' ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* categorias */}
          <aside className="anim-fadeUp h-fit rounded-xl border border-line bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-[14px] font-bold text-ink">Categorias</h3>
              {canEdit && (
                <button onClick={() => openCatModal(null)} className="rounded-md p-1.5 text-moss transition-colors hover:bg-mosssoft" aria-label="Nova categoria">
                  <Icon name="plus" size={16} />
                </button>
              )}
            </div>
            <button onClick={() => setCatSel('all')}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-bold transition-colors ${catSel === 'all' ? 'bg-mosssoft text-mossdark' : 'text-inksoft hover:bg-paper'}`}>
              Todos os serviços
              <span className="tnum text-[11.5px] font-bold text-inkfaint">{data.services.length}</span>
            </button>
            {data.categories.map((c) => (
              <div key={c.id} className={`group mb-1 flex items-center rounded-lg transition-colors ${catSel === c.id ? 'bg-mosssoft text-mossdark' : 'hover:bg-paper'}`}>
                <button onClick={() => setCatSel(c.id)} className="flex flex-1 items-center justify-between px-2.5 py-2 text-left text-[13px] font-bold">
                  <span className="truncate">{c.name}</span>
                  <span className="tnum text-[11.5px] font-bold text-inkfaint">{data.services.filter((s) => s.categoryId === c.id).length}</span>
                </button>
                {canEdit && (
                  <span className="hidden gap-0.5 pr-1.5 group-hover:flex">
                    <button onClick={() => openCatModal(c)} className="rounded p-1 text-inkfaint hover:text-ink" aria-label="Editar categoria"><Icon name="edit" size={13} /></button>
                    <button onClick={() => setDelCat(c)} className="rounded p-1 text-inkfaint hover:text-danger" aria-label="Excluir categoria"><Icon name="trash" size={13} /></button>
                  </span>
                )}
              </div>
            ))}
          </aside>

          {/* tabela serviços */}
          <section className="anim-fadeUp overflow-x-auto rounded-xl border border-line bg-card" style={{ animationDelay: '.08s' }}>
            {services.length === 0 ? (
              <div className="p-6"><EmptyState icon="scissors" title="Nenhum serviço aqui" desc="Cadastre serviços com duração e preço para habilitar o agendamento online.">
                {canEdit && <Btn icon="plus" onClick={() => setSvcModal({ open: true, svc: null })}>Criar primeiro serviço</Btn>}
              </EmptyState></div>
            ) : (
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-inkfaint">
                    <th className="px-4 py-3 font-bold">Serviço</th>
                    <th className="px-3 py-3 font-bold">Duração</th>
                    <th className="px-3 py-3 font-bold">Preço</th>
                    <th className="px-3 py-3 font-bold">Buffer</th>
                    <th className="px-3 py-3 font-bold">Máx/dia</th>
                    <th className="px-3 py-3 font-bold">Equipe</th>
                    <th className="px-3 py-3 font-bold">Ativo</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const cat = data.categories.find((c) => c.id === s.categoryId);
                    const nPros = s.professionalIds.length || data.professionals.filter((p) => p.active).length;
                    return (
                      <tr key={s.id} className="group border-b border-line/70 transition-colors last:border-0 hover:bg-paper/60">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white" style={{ background: s.color }}>
                              {s.imageUrl ? <img src={s.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="spark" size={15} />}
                            </span>
                            <div className="min-w-0">
                              <p className={`truncate font-bold ${s.active ? 'text-ink' : 'text-inkfaint line-through'}`}>{s.name}</p>
                              <p className="truncate text-[11.5px] text-inksoft">{cat?.name} · {s.description || 'sem descrição'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="tnum px-3 py-2.5 font-semibold">{s.durationMin} min</td>
                        <td className="tnum px-3 py-2.5 font-display font-bold">{fmtBRL(s.price)}</td>
                        <td className="tnum px-3 py-2.5 text-inksoft">{s.bufferBefore || s.bufferAfter ? `${s.bufferBefore}′ / ${s.bufferAfter}′` : '—'}</td>
                        <td className="tnum px-3 py-2.5 text-inksoft">{s.maxPerDay || '∞'}</td>
                        <td className="px-3 py-2.5"><Badge tone={s.professionalIds.length ? 'steel' : 'slate'}>{nPros} prof.</Badge></td>
                        <td className="px-3 py-2.5">
                          {canEdit ? (
                            <Toggle checked={s.active} onChange={(v) => {
                              mutate((d) => ({ ...d, services: d.services.map((x) => (x.id === s.id ? { ...x, active: v } : x)) }));
                              push(`“${s.name}” ${v ? 'ativado' : 'desativado'}.`, 'info');
                            }} />
                          ) : <Badge tone={s.active ? 'moss' : 'slate'}>{s.active ? 'sim' : 'não'}</Badge>}
                        </td>
                        <td className="px-3 py-2.5">
                          {canEdit && (
                            <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button onClick={() => setSvcModal({ open: true, svc: s })} className="rounded-md p-1.5 text-inksoft hover:bg-ink/5 hover:text-ink" aria-label="Editar"><Icon name="edit" size={15} /></button>
                              <button onClick={() => setDelSvc(s)} className="rounded-md p-1.5 text-inksoft hover:bg-dangersoft hover:text-danger" aria-label="Excluir"><Icon name="trash" size={15} /></button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : (
        /* ================= produtos ================= */
        <section className="anim-fadeUp overflow-x-auto rounded-xl border border-line bg-card">
          {data.products.length === 0 ? (
            <div className="p-6"><EmptyState icon="box" title="Nenhum produto" desc="Venda produtos no balcão ou junto ao agendamento." /></div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-inkfaint">
                  <th className="px-4 py-3 font-bold">Produto</th>
                  <th className="px-3 py-3 font-bold">Preço</th>
                  <th className="px-3 py-3 font-bold">Estoque</th>
                  <th className="px-3 py-3 font-bold">Ativo</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} className="group border-b border-line/70 transition-colors last:border-0 hover:bg-paper/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slatesoft text-slatey">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="box" size={15} />}
                        </span>
                        <div className="min-w-0">
                          <p className={`truncate font-bold ${p.active ? 'text-ink' : 'text-inkfaint line-through'}`}>{p.name}</p>
                          <p className="truncate text-[11.5px] text-inksoft">{p.description || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tnum px-3 py-2.5 font-display font-bold">{fmtBRL(p.price)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={p.stock === 0 ? 'danger' : p.stock < 5 ? 'amber' : 'moss'}>{p.stock === 0 ? 'esgotado' : p.stock < 5 ? `${p.stock} · baixo` : `${p.stock} un.`}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <Toggle checked={p.active} onChange={(v) => mutate((d) => ({ ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, active: v } : x)) }))} />
                      ) : <Badge tone={p.active ? 'moss' : 'slate'}>{p.active ? 'sim' : 'não'}</Badge>}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit && (
                        <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setPrdModal({ open: true, prd: p })} className="rounded-md p-1.5 text-inksoft hover:bg-ink/5 hover:text-ink" aria-label="Editar"><Icon name="edit" size={15} /></button>
                          <button onClick={() => setDelPrd(p)} className="rounded-md p-1.5 text-inksoft hover:bg-dangersoft hover:text-danger" aria-label="Excluir"><Icon name="trash" size={15} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {svcModal.open && <ServiceModal initial={svcModal.svc} onClose={() => setSvcModal({ open: false, svc: null })} />}
      {prdModal.open && <ProductModal initial={prdModal.prd} onClose={() => setPrdModal({ open: false, prd: null })} />}

      <Modal open={catModal.open} onClose={() => setCatModal({ open: false, cat: null })}
        title={catModal.cat ? 'Editar categoria' : 'Nova categoria'}
        footer={<><Btn variant="ghost" onClick={() => setCatModal({ open: false, cat: null })}>Cancelar</Btn><Btn icon="check" onClick={saveCat}>Salvar</Btn></>}>
        <div className="space-y-3.5">
          <Field label="Nome" req><TextInput value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex.: Cabelos" /></Field>
          <Field label="Descrição"><TextInput value={catDesc} onChange={(e) => setCatDesc(e.target.value)} /></Field>
        </div>
      </Modal>

      <Confirm open={!!delSvc} onClose={() => setDelSvc(null)} title="Excluir serviço"
        desc={`Excluir “${delSvc?.name}”? Agendamentos antigos permanecem no histórico, mas o serviço sai do portal e da recepção.`}
        onConfirm={() => { if (delSvc) { mutate((d) => ({ ...d, services: d.services.filter((s) => s.id !== delSvc.id) })); push('Serviço excluído.'); } }} />

      <Confirm open={!!delPrd} onClose={() => setDelPrd(null)} title="Excluir produto"
        desc={`Excluir “${delPrd?.name}” do catálogo?`}
        onConfirm={() => { if (delPrd) { mutate((d) => ({ ...d, products: d.products.filter((s) => s.id !== delPrd.id) })); push('Produto excluído.'); } }} />

      <Confirm open={!!delCat} onClose={() => setDelCat(null)} title="Excluir categoria"
        desc={delCat && data.services.some((s) => s.categoryId === delCat.id)
          ? `“${delCat.name}” ainda possui serviços. Mova-os de categoria antes de excluir.`
          : `Excluir a categoria “${delCat?.name}”?`}
        confirmLabel={delCat && data.services.some((s) => s.categoryId === delCat.id) ? 'Entendi' : 'Excluir'}
        danger={!(delCat && data.services.some((s) => s.categoryId === delCat.id))}
        onConfirm={() => {
          if (!delCat) return;
          if (data.services.some((s) => s.categoryId === delCat.id)) { push('Categoria em uso — não pode ser excluída.', 'err'); return; }
          mutate((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== delCat.id) }));
          if (catSel === delCat.id) setCatSel('all');
          push('Categoria excluída.');
        }} />
    </div>
  );
}
