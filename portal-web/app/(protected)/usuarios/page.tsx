"use client";
import { useMemo, useState, useEffect } from "react";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import { supabase } from "../../../lib/supabase";

type UserRole = "admin" | "gestor" | "corretor" | "vistoriador";
type UserStatus = "ativo" | "inativo";
type Usuario = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  criado_em: string; // ISO
};

// Função para buscar usuários do Supabase
async function fetchUsuarios(): Promise<Usuario[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
     
     if (error) {
       return [];
     }
    
    return data?.map(user => ({
      id: user.id,
      nome: user.name || user.email,
      email: user.email,
      role: user.role || 'corretor',
      status: user.active ? 'ativo' : 'inativo',
      criado_em: user.created_at
    })) || [];
  } catch (error) {
    return [];
  }
}

export default function UsuariosPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"todas" | UserRole>("todas");
  const [status, setStatus] = useState<"todos" | UserStatus>("todos");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Usuario | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 10;

  // Carregar usuários do Supabase
  useEffect(() => {
    async function loadUsuarios() {
      setLoading(true);
      const usuarios = await fetchUsuarios();
      setItems(usuarios);
      setLoading(false);
    }
    loadUsuarios();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((u) => {
      const q = `${u.nome} ${u.email}`.toLowerCase();
      const matchesQ = q.includes(query.toLowerCase());
      const matchesRole = role === "todas" ? true : u.role === role;
      const matchesStatus = status === "todos" ? true : u.status === status;
      return matchesQ && matchesRole && matchesStatus;
    });
  }, [items, query, role, status]);

  const total = filtered.length;
  const kpiAtivos = useMemo(() => filtered.filter((u) => u.status === "ativo").length, [filtered]);
  const kpiInativos = useMemo(() => filtered.filter((u) => u.status === "inativo").length, [filtered]);
  const kpiAdmins = useMemo(() => filtered.filter((u) => u.role === "admin").length, [filtered]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function openCreate() {
    setEditing({
      id: "",
      nome: "",
      email: "",
      role: "corretor",
      status: "ativo",
      criado_em: new Date().toISOString(),
    });
    setIsOpen(true);
  }
  function openEdit(u: Usuario) {
    setEditing({ ...u });
    setIsOpen(true);
  }
  function closeModal() {
    setIsOpen(false);
    setEditing(null);
  }
  function saveItem() {
    if (!editing) return;
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
    setToast({ message: "Usuário salvo com sucesso", tone: "success" });
    setTimeout(() => setToast(null), 2000);
  }
  function askRemove(u: Usuario) {
    setToDelete(u);
  }
  function confirmRemove() {
    if (!toDelete) return;
    const id = toDelete.id;
    setItems((prev) => prev.filter((p) => p.id !== id));
    setToDelete(null);
    setToast({ message: "Usuário excluído", tone: "success" });
    setTimeout(() => setToast(null), 2000);
  }
  function cancelRemove() {
    setToDelete(null);
  }

  function statusBadge(s: UserStatus) {
    const tone: Record<UserStatus, "emerald" | "zinc"> = {
      ativo: "emerald",
      inativo: "zinc",
    };
    const icon: Record<UserStatus, JSX.Element> = {
      ativo: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ),
      inativo: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59Z" />
        </svg>
      ),
    };
    return (
      <StatusBadge tone={tone[s]} leftIcon={icon[s]}>
        {s}
      </StatusBadge>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Usuários</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gestão de usuários e papéis</p>
        </div>
        <Tooltip content="Criar novo usuário">
          <button onClick={openCreate} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/30">
            Novo usuário
          </button>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Ativos" value={kpiAtivos} color="#10b981" />
        <KpiCard label="Inativos" value={kpiInativos} color="#71717a" />
        <KpiCard label="Admins" value={kpiAdmins} color="#f59e0b" />
      </section>

      {/* Filtros (desktop) */}
      <div className="hidden md:block">
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 flex gap-2">
            <input
              placeholder="Buscar por nome ou e-mail"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="flex-1 h-9 px-3 rounded-md border border-input bg-background"
            />
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value as any); setPage(1); }}
              className="h-9 px-2 rounded-md border border-input bg-background"
            >
              <option value="todas">Todos papéis</option>
              <option value="admin">Admin</option>
              <option value="gestor">Gestor</option>
              <option value="corretor">Corretor</option>
              <option value="vistoriador">Vistoriador</option>
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
              className="h-9 px-2 rounded-md border border-input bg-background"
            >
              <option value="todos">Todos status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">{total} resultados</span>
          </div>
        </div>
        {/* Quick chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Filtros rápidos">
          {/* Status chips */}
          <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos status</button>
          <button className={`px-2 py-1 rounded-md border ${status === "ativo" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("ativo"); setPage(1); }}>Ativo</button>
          <button className={`px-2 py-1 rounded-md border ${status === "inativo" ? "bg-zinc-500/15 border-zinc-500/30 text-zinc-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("inativo"); setPage(1); }}>Inativo</button>
          {/* Role chips */}
          <span className="mx-2 h-4 w-px bg-border align-middle" aria-hidden></span>
          <button className={`px-2 py-1 rounded-md border ${role === "todas" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("todas"); setPage(1); }}>Todos papéis</button>
          <button className={`px-2 py-1 rounded-md border ${role === "admin" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setRole("admin"); setPage(1); }}>Admin</button>
          <button className={`px-2 py-1 rounded-md border ${role === "gestor" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("gestor"); setPage(1); }}>Gestor</button>
          <button className={`px-2 py-1 rounded-md border ${role === "corretor" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("corretor"); setPage(1); }}>Corretor</button>
          <button className={`px-2 py-1 rounded-md border ${role === "vistoriador" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("vistoriador"); setPage(1); }}>Vistoriador</button>
        </div>
      </SectionCard>
      </div>

      {/* Filtros (mobile trigger) */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              placeholder="Buscar por nome ou e-mail"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background"
              aria-label="Buscar usuários"
            />
            <svg aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4a6 6 0 104.472 10.028l4.75 4.75 1.414-1.414-4.75-4.75A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
          </div>
          <button onClick={() => setFiltersOpen(true)} className="h-9 px-3 rounded-md border border-border bg-card hover:bg-muted/30 text-sm" aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="mobile-filters-sheet-usuarios">
            Filtros{(role !== "todas" || status !== "todos") && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden></span>}
          </button>
        </div>
      </div>

      {/* Lista */}
      <SectionCard title="Lista de usuários" subtitle="Dados reais">
        {/* Mobile cards (sm) */}
        <div className="md:hidden">
          <ul role="list" className="space-y-2">
            {pageItems.map((u) => (
              <li key={u.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{u.nome}</h3>
                      <span className="text-[10px] text-muted-foreground">#{u.id}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="shrink-0">{statusBadge(u.status)}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Papel</div>
                    <div className="capitalize">{u.role}</div>
                  </div>
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Status</div>
                    <div>{statusBadge(u.status)}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    aria-label={`Editar usuário ${u.nome}`}
                    onClick={() => openEdit(u)}
                    className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    aria-label={`Excluir usuário ${u.nome}`}
                    onClick={() => askRemove(u)}
                    className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
            {pageItems.length === 0 && (
              <li className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground" aria-live="polite">
                Nenhum resultado para os filtros atuais.
              </li>
            )}
          </ul>
        </div>

        {/* Table (md+) */}
        <div className="hidden md:block overflow-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <tr>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Nome completo"><span>Nome</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="E-mail corporativo"><span>E-mail</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Papel do usuário no portal"><span>Papel</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Situação de acesso"><span>Status</span></Tooltip>
                </th>
                <th scope="col" className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => (
                <tr key={u.id} className="border-t border-border odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2">{statusBadge(u.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button aria-label={`Editar usuário ${u.nome}`} onClick={() => openEdit(u)} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30">Editar</button>
                      <button aria-label={`Excluir usuário ${u.nome}`} onClick={() => askRemove(u)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground" aria-live="polite">Nenhum resultado para os filtros atuais.</td>
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

      {/* Mobile Filters Modal (Bottom Sheet) */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50" role="dialog" aria-modal="true" aria-labelledby="mobile-filters-title-usuarios" id="mobile-filters-sheet-usuarios" onClick={() => setFiltersOpen(false)}>
          <div className="w-full rounded-t-2xl border border-border bg-card p-4 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 id="mobile-filters-title-usuarios" className="text-base font-semibold">Filtros</h3>
                <p className="text-xs text-muted-foreground">{total} resultados</p>
              </div>
              <button className="text-sm text-muted-foreground hover:opacity-80" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">Fechar</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="relative">
                <input
                  placeholder="Buscar por nome ou e-mail"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background"
                />
                <svg aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4a6 6 0 104.472 10.028l4.75 4.75 1.414-1.414-4.75-4.75A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Papel</label>
                  <select value={role} onChange={(e) => { setRole(e.target.value as any); setPage(1); }} className="mt-1 h-10 w-full px-2 rounded-md border border-input bg-background">
                    <option value="todas">Todos papéis</option>
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                    <option value="corretor">Corretor</option>
                    <option value="vistoriador">Vistoriador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="mt-1 h-10 w-full px-2 rounded-md border border-input bg-background">
                    <option value="todos">Todos status</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">Filtros rápidos</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos status</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "ativo" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("ativo"); setPage(1); }}>Ativo</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "inativo" ? "bg-zinc-500/15 border-zinc-500/30 text-zinc-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("inativo"); setPage(1); }}>Inativo</button>
                  <span className="mx-2 h-4 w-px bg-border align-middle" aria-hidden></span>
                  <button className={`px-2 py-1 rounded-md border ${role === "todas" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("todas"); setPage(1); }}>Todos papéis</button>
                  <button className={`px-2 py-1 rounded-md border ${role === "admin" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setRole("admin"); setPage(1); }}>Admin</button>
                  <button className={`px-2 py-1 rounded-md border ${role === "gestor" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("gestor"); setPage(1); }}>Gestor</button>
                  <button className={`px-2 py-1 rounded-md border ${role === "corretor" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("corretor"); setPage(1); }}>Corretor</button>
                  <button className={`px-2 py-1 rounded-md border ${role === "vistoriador" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setRole("vistoriador"); setPage(1); }}>Vistoriador</button>
                </div>
              </div>
              <div className="mt-2 flex justify-between">
                <button className="px-3 py-2 rounded-md border border-border text-sm" onClick={() => { setQuery(""); setRole("todas"); setStatus("todos"); setPage(1); setFiltersOpen(false); }}>Limpar</button>
                <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm" onClick={() => { setPage(1); setFiltersOpen(false); }}>Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="dialog-usuarios-title">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-[0_0_12px_#0006]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="dialog-usuarios-title" className="text-lg font-medium">{editing.id ? "Editar usuário" : "Novo usuário"}</h3>
              <button className="text-sm text-muted-foreground hover:opacity-80" onClick={closeModal}>Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Nome</label>
                <input value={editing.nome} onChange={(e) => setEditing((prev) => prev ? { ...prev, nome: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">E-mail</label>
                <input value={editing.email} onChange={(e) => setEditing((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Papel</label>
                <select value={editing.role} onChange={(e) => setEditing((prev) => prev ? { ...prev, role: e.target.value as UserRole } : prev)} className="mt-1 h-9 w-full px-2 rounded-md border border-input bg-background">
                  <option value="admin">Admin</option>
                  <option value="gestor">Gestor</option>
                  <option value="corretor">Corretor</option>
                  <option value="vistoriador">Vistoriador</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value as UserStatus } : prev)} className="mt-1 h-9 w-full px-2 rounded-md border border-input bg-background">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={cancelRemove}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-2">Confirmar exclusão</h3>
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
