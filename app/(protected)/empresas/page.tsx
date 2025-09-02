"use client";
import { useMemo, useState, useEffect } from "react";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import grifoPortalApiService, { Empresa as ApiEmpresa } from "../../../lib/api";

type EmpresaStatus = "ativa" | "inativa";
type Empresa = {
  id: string;
  nome: string;
  cnpj: string;
  contato: string;
  email: string;
  status: EmpresaStatus;
  criada_em: string; // ISO
};

// Função para buscar empresas da API
async function fetchEmpresas(): Promise<Empresa[]> {
  try {
    const response = await grifoPortalApiService.getEmpresas();
     
     if (!response.success || !response.data) {
       return [];
     }
    
    return response.data.map(empresa => ({
      id: empresa.id || '',
      nome: empresa.name,
      cnpj: empresa.cnpj || '',
      contato: empresa.phone || 'Não informado',
      email: empresa.email || '',
      status: 'ativa' as EmpresaStatus, // Assumindo que empresas retornadas estão ativas
      criada_em: empresa.created_at || new Date().toISOString()
    }));
  } catch (error) {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch companies:', error instanceof Error ? error.message : error);
    }
    return [];
  }
}

export default function EmpresasPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | EmpresaStatus>("todos");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Empresa | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const pageSize = 10;

  // Carregar empresas do Supabase
  useEffect(() => {
    async function loadEmpresas() {
      setLoading(true);
      const empresas = await fetchEmpresas();
      setItems(empresas);
      setLoading(false);
    }
    loadEmpresas();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      const q = `${e.nome} ${e.cnpj} ${e.contato} ${e.email}`.toLowerCase();
      const matchesQ = q.includes(query.toLowerCase());
      const matchesStatus = status === "todos" ? true : e.status === status;
      return matchesQ && matchesStatus;
    });
  }, [items, query, status]);

  const total = filtered.length;
  const kpiAtivas = useMemo(() => filtered.filter((e) => e.status === "ativa").length, [filtered]);
  const kpiInativas = useMemo(() => filtered.filter((e) => e.status === "inativa").length, [filtered]);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const kpiNovas7d = useMemo(
    () => filtered.filter((e) => new Date(e.criada_em).getTime() >= Date.now() - sevenDaysMs).length,
    [filtered, sevenDaysMs]
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function openCreate() {
    setEditing({
      id: "",
      nome: "",
      cnpj: "",
      contato: "",
      email: "",
      status: "ativa",
      criada_em: new Date().toISOString(),
    });
    setIsOpen(true);
  }
  function openEdit(e: Empresa) {
    setEditing({ ...e });
    setIsOpen(true);
  }
  function closeModal() {
    setIsOpen(false);
    setEditing(null);
  }
  function saveItem() {
    if (!editing) return;
    const onlyDigits = (s: string) => s.replace(/\D/g, "");
    const maskCNPJ = (v: string) => {
      const d = onlyDigits(v).slice(0, 14);
      const p1 = d.slice(0, 2);
      const p2 = d.slice(2, 5);
      const p3 = d.slice(5, 8);
      const p4 = d.slice(8, 12);
      const p5 = d.slice(12, 14);
      let out = p1;
      if (p2) out += "." + p2;
      if (p3) out += "." + p3;
      if (p4) out += "/" + p4;
      if (p5) out += "-" + p5;
      return out;
    };
    const isCNPJValidFormat = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(editing.cnpj);
    if (!isCNPJValidFormat) {
      // tenta formatar automaticamente se vier só dígitos
      const digits = onlyDigits(editing.cnpj);
      if (digits.length === 14) {
        editing.cnpj = maskCNPJ(digits);
      } else {
        setToast({ message: "CNPJ inválido", tone: "error" });
        setTimeout(() => setToast(null), 2500);
        return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) {
      setToast({ message: "E-mail inválido", tone: "error" });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (editing.id) {
      setItems((prev) => prev.map((p) => (p.id === editing.id ? editing : p)));
    } else {
      const newId = (Math.max(0, ...items.map((x) => Number(x.id))) + 1).toString();
      setItems((prev) => [{ ...editing, id: newId }, ...prev]);
    }
    closeModal();
    setToast({ message: "Empresa salva com sucesso", tone: "success" });
    setTimeout(() => setToast(null), 2000);
  }
  function askRemove(e: Empresa) {
    setToDelete(e);
  }
  function confirmRemove() {
    if (!toDelete) return;
    const id = toDelete.id;
    setItems((prev) => prev.filter((p) => p.id !== id));
    setToDelete(null);
    setToast({ message: "Empresa excluída", tone: "success" });
    setTimeout(() => setToast(null), 2000);
  }
  function cancelRemove() {
    setToDelete(null);
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Empresas</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground">Gestão de empresas parceiras</p>
        </div>
        <Tooltip content="Criar nova empresa">
          <button onClick={openCreate} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/30">
            Nova empresa
          </button>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Ativas" value={kpiAtivas} color="#10b981" />
        <KpiCard label="Inativas" value={kpiInativas} color="#71717a" />
        <KpiCard label="Novas (7d)" value={kpiNovas7d} color="#3b82f6" />
      </section>

      {/* Filtros */}
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Buscar por nome, CNPJ, contato ou e-mail"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-md border border-input bg-background"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
            className="h-9 px-2 rounded-md border border-input bg-background"
          >
            <option value="todos">Todos status</option>
            <option value="ativa">Ativa</option>
            <option value="inativa">Inativa</option>
          </select>
          <div className="flex items-center justify-end text-sm text-muted-foreground">{total} resultados</div>
        </div>
        {/* Quick chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Filtros rápidos">
          <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos status</button>
          <button className={`px-2 py-1 rounded-md border ${status === "ativa" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("ativa"); setPage(1); }}>Ativa</button>
          <button className={`px-2 py-1 rounded-md border ${status === "inativa" ? "bg-zinc-500/15 border-zinc-500/30 text-zinc-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("inativa"); setPage(1); }}>Inativa</button>
        </div>
      </SectionCard>

      {/* Lista */}
      <SectionCard title="Lista de empresas" subtitle="Dados reais">
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {pageItems.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
              Nenhum resultado para os filtros atuais.
            </div>
          ) : (
            pageItems.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium leading-5">{e.nome}</div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{e.cnpj}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button aria-label={`Editar empresa ${e.nome}`} onClick={() => openEdit(e)} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30">Editar</button>
                    <button aria-label={`Excluir empresa ${e.nome}`} onClick={() => askRemove(e)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">Excluir</button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                  <div><span className="sr-only">Contato:</span>{e.contato}</div>
                  <div className="truncate"><span className="sr-only">E-mail:</span>{e.email}</div>
                  <div className="mt-1"><span className="sr-only">Status:</span><StatusBadge tone={e.status === "ativa" ? "emerald" : "zinc"}>{e.status}</StatusBadge></div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <tr>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Razão/Nome fantasia"><span>Empresa</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="CNPJ no padrão 00.000.000/0000-00"><span>CNPJ</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Pessoa responsável"><span>Contato</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="E-mail principal"><span>E-mail</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Situação da empresa"><span>Status</span></Tooltip>
                </th>
                <th scope="col" className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((e) => (
                <tr key={e.id} className="border-t border-border odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                  <td className="px-3 py-2">{e.nome}</td>
                  <td className="px-3 py-2">{e.cnpj}</td>
                  <td className="px-3 py-2">{e.contato}</td>
                  <td className="px-3 py-2">{e.email}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      tone={e.status === "ativa" ? "emerald" : "zinc"}
                      leftIcon={e.status === "ativa" ? (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59Z" /></svg>
                      )}
                    >
                      {e.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button aria-label={`Editar empresa ${e.nome}`} onClick={() => openEdit(e)} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30">Editar</button>
                      <button aria-label={`Excluir empresa ${e.nome}`} onClick={() => askRemove(e)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground" aria-live="polite">Nenhum resultado para os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Paginação */}
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
            <button className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
          </div>
        </div>
      </SectionCard>

      {isOpen && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="dialog-empresas-title">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-[0_0_12px_#0006]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="dialog-empresas-title" className="text-lg font-medium">{editing.id ? "Editar empresa" : "Nova empresa"}</h3>
              <button className="text-sm text-muted-foreground hover:opacity-80" onClick={closeModal}>Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Nome</label>
                <input value={editing.nome} onChange={(e) => setEditing((prev) => prev ? { ...prev, nome: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CNPJ</label>
                <input
                  value={editing.cnpj}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 14);
                    const masked = v
                      .replace(/(\d{2})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d)/, "$1/$2")
                      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
                    setEditing((prev) => (prev ? { ...prev, cnpj: masked } : prev));
                  }}
                  inputMode="numeric"
                  className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contato</label>
                <input value={editing.contato} onChange={(e) => setEditing((prev) => prev ? { ...prev, contato: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">E-mail</label>
                <input value={editing.email} onChange={(e) => setEditing((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value as EmpresaStatus } : prev)} className="mt-1 h-9 w-full px-2 rounded-md border border-input bg-background">
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md border border-border" onClick={closeModal}>Cancelar</button>
              <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={saveItem}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={cancelRemove} role="dialog" aria-modal="true" aria-labelledby="dialog-empresas-remove-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 id="dialog-empresas-remove-title" className="text-lg font-medium mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-muted-foreground mb-4">Tem certeza que deseja excluir &quot;{toDelete.nome}&quot;?</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md border border-border" onClick={cancelRemove}>Cancelar</button>
              <button className="px-3 py-2 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10" onClick={confirmRemove}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-md px-3 py-2 text-sm shadow-md border ${toast.tone === "success" ? "bg-emerald-600 text-white border-emerald-500" : "bg-rose-600 text-white border-rose-500"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
