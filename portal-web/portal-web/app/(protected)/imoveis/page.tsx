"use client";
import React, { useMemo, useState, useEffect } from "react";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import grifoPortalApiService from "../../../lib/api";

// Força renderização dinâmica para esta página
export const dynamic = 'force-dynamic'

type ImovelStatus = "ativo" | "inativo" | "alugado" | "manutencao";
type ImovelTipo = "apartamento" | "casa" | "comercial" | "terreno";
type Imovel = {
  id: string;
  titulo: string;
  endereco: string;
  tipo: ImovelTipo;
  status: ImovelStatus;
  quartos: number;
  area_m2: number;
  valor: number; // R$
  criado_em: string; // ISO
};



export default function ImoveisPage() {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<"todos" | ImovelTipo>("todos");
  const [status, setStatus] = useState<"todos" | ImovelStatus>("todos");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Imovel | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Imovel | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 10;

  // Carregar imóveis da API
  useEffect(() => {
    async function fetchImoveis() {
      setLoading(true);
      try {
        const response = await grifoPortalApiService.getProperties();

        if (!response.success || !response.data) {
          setItems([]);
          return;
        }

        const imoveisFormatados: Imovel[] = response.data.map(property => ({
          id: property.id || '',
          titulo: `Imóvel ${property.id}`, // Propriedade title não disponível no tipo
          endereco: 'Endereço não informado', // Propriedade address não disponível no tipo
          tipo: (property.type as ImovelTipo) || 'apartamento',
          status: 'ativo' as ImovelStatus, // Assumindo que propriedades retornadas estão ativas
          quartos: 0, // Propriedade bedrooms não disponível no tipo
          area_m2: 0, // Propriedade area não disponível no tipo
          valor: 0, // Propriedade price não disponível no tipo
          criado_em: property.created_at || new Date().toISOString()
        }));

        setItems(imoveisFormatados);
      } catch (error) {
        // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch properties:', error instanceof Error ? error.message : error);
    }
        setItems([]);
      }
      setLoading(false);
    }

    fetchImoveis();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((im) => {
      const q = `${im.titulo} ${im.endereco}`.toLowerCase();
      const matchesQ = q.includes(query.toLowerCase());
      const matchesTipo = tipo === "todos" ? true : im.tipo === tipo;
      const matchesStatus = status === "todos" ? true : im.status === status;
      return matchesQ && matchesTipo && matchesStatus;
    });
  }, [items, query, tipo, status]);

  const total = filtered.length;
  const kpiAtivos = useMemo(() => filtered.filter((im) => im.status === "ativo").length, [filtered]);
  const kpiAlugados = useMemo(() => filtered.filter((im) => im.status === "alugado").length, [filtered]);
  const kpiManutencao = useMemo(() => filtered.filter((im) => im.status === "manutencao").length, [filtered]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function openCreate() {
    setEditing({
      id: "",
      titulo: "",
      endereco: "",
      tipo: "apartamento",
      status: "ativo",
      quartos: 2,
      area_m2: 60,
      valor: 1500,
      criado_em: new Date().toISOString(),
    });
    setIsOpen(true);
  }
  function openEdit(im: Imovel) {
    setEditing({ ...im });
    setIsOpen(true);
  }
  function closeModal() {
    setIsOpen(false);
    setEditing(null);
  }
  async function saveItem() {
    if (!editing) return;
    
    try {
      if (editing.id) {
        // update
        const response = await grifoPortalApiService.updateProperty(editing.id, {
          type: editing.tipo
          // Outras propriedades não disponíveis no tipo Property
        });

        if (!response.success) {
          setToast({ message: "Erro ao salvar imóvel", tone: "error" });
          return;
        }

        setItems((prev) => prev.map((p) => (p.id === editing.id ? editing : p)));
      } else {
        // create
        const response = await grifoPortalApiService.createProperty({
          type: editing.tipo
          // Outras propriedades não disponíveis no tipo Property
        });

        if (!response.success || !response.data) {
          setToast({ message: "Erro ao criar imóvel", tone: "error" });
          return;
        }

        const novoImovel: Imovel = {
          id: response.data.id || '',
          titulo: editing.titulo, // Property não tem title
          endereco: editing.endereco, // Property não tem address
          tipo: response.data.type as ImovelTipo || editing.tipo,
          status: editing.status, // Property não tem status
          quartos: editing.quartos, // Property não tem bedrooms
          area_m2: editing.area_m2, // Property não tem area
          valor: editing.valor, // Property não tem price
          criado_em: response.data.created_at || new Date().toISOString()
        };

        setItems((prev) => [novoImovel, ...prev]);
      }
      
      closeModal();
      setToast({ message: "Imóvel salvo com sucesso", tone: "success" });
    } catch (error) {
      setToast({ message: "Erro ao salvar imóvel", tone: "error" });
    }
    
    setTimeout(() => setToast(null), 2000);
  }
  function askRemove(im: Imovel) {
    setToDelete(im);
  }
  async function confirmRemove() {
    if (!toDelete) return;
    
    try {
      const response = await grifoPortalApiService.deleteProperty(toDelete.id);

      if (!response.success) {
        setToast({ message: "Erro ao excluir imóvel", tone: "error" });
        return;
      }

      setItems((prev) => prev.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
      setToast({ message: "Imóvel excluído", tone: "success" });
    } catch (error) {
      setToast({ message: "Erro ao excluir imóvel", tone: "error" });
    }
    
    setTimeout(() => setToast(null), 2000);
  }
  function cancelRemove() {
    setToDelete(null);
  }

  function statusBadge(s: ImovelStatus) {
    const tone: Record<ImovelStatus, "emerald" | "zinc" | "blue" | "amber"> = {
      ativo: "emerald",
      inativo: "zinc",
      alugado: "blue",
      manutencao: "amber",
    };
    const icon: Record<ImovelStatus, JSX.Element> = {
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
      alugado: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 6a6 6 0 1 1-4.24 10.24l-2.12 2.12-1.41-1.41 2.12-2.12A6 6 0 0 1 12 6Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
      ),
      manutencao: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22.7 19.3 14.4 11a6 6 0 1 0-3.4 3.4l8.3 8.3 3.4-3.4ZM4 10a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
        </svg>
      ),
    };
    return (
      <StatusBadge tone={tone[s]} leftIcon={icon[s]}>
        {s === "manutencao" ? "manutenção" : s}
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
          <li aria-current="page" className="text-foreground">Imóveis</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Imóveis</h1>
          <p className="text-sm text-muted-foreground">{loading ? 'Carregando...' : 'UI de lista e cadastro'}</p>
        </div>
        <Tooltip content="Criar novo imóvel">
          <button onClick={openCreate} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/30">
            Novo imóvel
          </button>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Ativos" value={kpiAtivos} color="#10b981" />
        <KpiCard label="Alugados" value={kpiAlugados} color="#3b82f6" />
        <KpiCard label="Em manutenção" value={kpiManutencao} color="#f59e0b" />
      </section>

      {/* Filtros (desktop) */}
      <div className="hidden md:block">
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 flex gap-2">
            <input
              placeholder="Buscar por título ou endereço"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="flex-1 h-9 px-3 rounded-md border border-input bg-background"
            />
            <select
              value={tipo}
              onChange={(e) => { setTipo(e.target.value as any); setPage(1); }}
              className="h-9 px-2 rounded-md border border-input bg-background"
            >
              <option value="todos">Todos tipos</option>
              <option value="apartamento">Apartamento</option>
              <option value="casa">Casa</option>
              <option value="comercial">Comercial</option>
              <option value="terreno">Terreno</option>
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
              className="h-9 px-2 rounded-md border border-input bg-background"
            >
              <option value="todos">Todos status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="alugado">Alugado</option>
              <option value="manutencao">Manutenção</option>
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
          <button className={`px-2 py-1 rounded-md border ${status === "alugado" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("alugado"); setPage(1); }}>Alugado</button>
          <button className={`px-2 py-1 rounded-md border ${status === "manutencao" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("manutencao"); setPage(1); }}>Manutenção</button>
          {/* Tipo chips */}
          <span className="mx-2 h-4 w-px bg-border align-middle" aria-hidden></span>
          <button className={`px-2 py-1 rounded-md border ${tipo === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("todos"); setPage(1); }}>Todos tipos</button>
          <button className={`px-2 py-1 rounded-md border ${tipo === "apartamento" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("apartamento"); setPage(1); }}>Apartamento</button>
          <button className={`px-2 py-1 rounded-md border ${tipo === "casa" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("casa"); setPage(1); }}>Casa</button>
          <button className={`px-2 py-1 rounded-md border ${tipo === "comercial" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("comercial"); setPage(1); }}>Comercial</button>
          <button className={`px-2 py-1 rounded-md border ${tipo === "terreno" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("terreno"); setPage(1); }}>Terreno</button>
        </div>
      </SectionCard>
      </div>

      {/* Filtros (mobile trigger) */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              placeholder="Buscar por título ou endereço"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background"
              aria-label="Buscar imóveis"
            />
            <svg aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4a6 6 0 104.472 10.028l4.75 4.75 1.414-1.414-4.75-4.75A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
          </div>
          <button onClick={() => setFiltersOpen(true)} className="h-9 px-3 rounded-md border border-border bg-card hover:bg-muted/30 text-sm" aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="mobile-filters-sheet">
            Filtros{(tipo !== "todos" || status !== "todos") && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden></span>}
          </button>
        </div>
      </div>

      {/* Lista */}
      <SectionCard title="Lista de imóveis" subtitle="Dados reais">
        {/* Mobile cards (sm) */}
        <div className="md:hidden">
          <ul role="list" className="space-y-2">
            {pageItems.map((im) => (
              <li key={im.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium capitalize">{im.titulo}</h3>
                      <span className="text-[10px] text-muted-foreground">#{im.id}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{im.endereco}</div>
                  </div>
                  <div className="shrink-0">{statusBadge(im.status)}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Tipo</div>
                    <div className="capitalize">{im.tipo}</div>
                  </div>
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Quartos</div>
                    <div>{im.quartos}</div>
                  </div>
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Área (m²)</div>
                    <div>{im.area_m2}</div>
                  </div>
                  <div className="rounded-md border border-border/60 px-2 py-1">
                    <div className="text-muted-foreground">Valor (R$)</div>
                    <div>{im.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    aria-label={`Editar imóvel ${im.titulo}`}
                    onClick={() => openEdit(im)}
                    className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    aria-label={`Excluir imóvel ${im.titulo}`}
                    onClick={() => askRemove(im)}
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
                  <Tooltip content="Título do imóvel e endereço"><span>Imóvel</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Tipo cadastrado"><span>Tipo</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Situação"><span>Status</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Quantidade de quartos"><span>Quartos</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Área útil em metros quadrados"><span>Área (m²)</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Valor mensal ou base"><span>Valor (R$)</span></Tooltip>
                </th>
                <th scope="col" className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((im) => (
                <tr key={im.id} className="border-t border-border odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="font-medium">{im.titulo}</div>
                    <div className="text-muted-foreground text-xs">{im.endereco}</div>
                  </td>
                  <td className="px-3 py-2 capitalize">{im.tipo}</td>
                  <td className="px-3 py-2">{statusBadge(im.status)}</td>
                  <td className="px-3 py-2">{im.quartos}</td>
                  <td className="px-3 py-2">{im.area_m2}</td>
                  <td className="px-3 py-2">{im.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button aria-label={`Editar imóvel ${im.titulo}`} onClick={() => openEdit(im)} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30">Editar</button>
                      <button aria-label={`Excluir imóvel ${im.titulo}`} onClick={() => askRemove(im)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground" aria-live="polite">Nenhum resultado para os filtros atuais.</td>
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
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50" role="dialog" aria-modal="true" aria-labelledby="mobile-filters-title" id="mobile-filters-sheet" onClick={() => setFiltersOpen(false)}>
          <div className="w-full rounded-t-2xl border border-border bg-card p-4 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 id="mobile-filters-title" className="text-base font-semibold">Filtros</h3>
                <p className="text-xs text-muted-foreground">{total} resultados</p>
              </div>
              <button className="text-sm text-muted-foreground hover:opacity-80" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">Fechar</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="relative">
                <input
                  placeholder="Buscar por título ou endereço"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background"
                />
                <svg aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4a6 6 0 104.472 10.028l4.75 4.75 1.414-1.414-4.75-4.75A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select value={tipo} onChange={(e) => { setTipo(e.target.value as any); setPage(1); }} className="mt-1 h-10 w-full px-2 rounded-md border border-input bg-background">
                    <option value="todos">Todos tipos</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="comercial">Comercial</option>
                    <option value="terreno">Terreno</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="mt-1 h-10 w-full px-2 rounded-md border border-input bg-background">
                    <option value="todos">Todos status</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="alugado">Alugado</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">Filtros rápidos</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos status</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "ativo" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("ativo"); setPage(1); }}>Ativo</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "inativo" ? "bg-zinc-500/15 border-zinc-500/30 text-zinc-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("inativo"); setPage(1); }}>Inativo</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "alugado" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("alugado"); setPage(1); }}>Alugado</button>
                  <button className={`px-2 py-1 rounded-md border ${status === "manutencao" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("manutencao"); setPage(1); }}>Manutenção</button>
                  <span className="mx-2 h-4 w-px bg-border align-middle" aria-hidden></span>
                  <button className={`px-2 py-1 rounded-md border ${tipo === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("todos"); setPage(1); }}>Todos tipos</button>
                  <button className={`px-2 py-1 rounded-md border ${tipo === "apartamento" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("apartamento"); setPage(1); }}>Apartamento</button>
                  <button className={`px-2 py-1 rounded-md border ${tipo === "casa" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("casa"); setPage(1); }}>Casa</button>
                  <button className={`px-2 py-1 rounded-md border ${tipo === "comercial" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("comercial"); setPage(1); }}>Comercial</button>
                  <button className={`px-2 py-1 rounded-md border ${tipo === "terreno" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setTipo("terreno"); setPage(1); }}>Terreno</button>
                </div>
              </div>
              <div className="mt-2 flex justify-between">
                <button className="px-3 py-2 rounded-md border border-border text-sm" onClick={() => { setQuery(""); setTipo("todos"); setStatus("todos"); setPage(1); setFiltersOpen(false); }}>Limpar</button>
                <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm" onClick={() => { setPage(1); setFiltersOpen(false); }}>Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal simples para criar/editar */}
      {isOpen && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="dialog-imoveis-title">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-[0_0_12px_#0006]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="dialog-imoveis-title" className="text-lg font-medium">{editing.id ? "Editar imóvel" : "Novo imóvel"}</h3>
              <button className="text-sm text-muted-foreground hover:opacity-80" onClick={closeModal}>Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Título</label>
                <input value={editing.titulo} onChange={(e) => setEditing((prev) => prev ? { ...prev, titulo: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Endereço</label>
                <input value={editing.endereco} onChange={(e) => setEditing((prev) => prev ? { ...prev, endereco: e.target.value } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select value={editing.tipo} onChange={(e) => setEditing((prev) => prev ? { ...prev, tipo: e.target.value as ImovelTipo } : prev)} className="mt-1 h-9 w-full px-2 rounded-md border border-input bg-background">
                  <option value="apartamento">Apartamento</option>
                  <option value="casa">Casa</option>
                  <option value="comercial">Comercial</option>
                  <option value="terreno">Terreno</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value as ImovelStatus } : prev)} className="mt-1 h-9 w-full px-2 rounded-md border border-input bg-background">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="alugado">Alugado</option>
                  <option value="manutencao">Manutenção</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quartos</label>
                <input type="number" min={0} value={editing.quartos} onChange={(e) => setEditing((prev) => prev ? { ...prev, quartos: Number(e.target.value) } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Área (m²)</label>
                <input type="number" min={0} value={editing.area_m2} onChange={(e) => setEditing((prev) => prev ? { ...prev, area_m2: Number(e.target.value) } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Valor (R$)</label>
                <input type="number" min={0} value={editing.valor} onChange={(e) => setEditing((prev) => prev ? { ...prev, valor: Number(e.target.value) } : prev)} className="mt-1 h-9 w-full px-3 rounded-md border border-input bg-background" />
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={cancelRemove} role="dialog" aria-modal="true" aria-labelledby="dialog-imoveis-remove-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 id="dialog-imoveis-remove-title" className="text-lg font-medium mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-muted-foreground mb-4">Tem certeza que deseja excluir &quot;{toDelete.titulo}&quot;?</p>
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
