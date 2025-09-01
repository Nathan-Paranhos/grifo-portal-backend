"use client";
import React, { useMemo, useState, useEffect } from "react";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import grifoPortalApiService from "../../../lib/api";

type ContestStatus = "pendente" | "em_analise" | "resolvida" | "rejeitada";
type ContestItem = {
  id: string;
  vistoria_id: string;
  imovel: string;
  endereco: string;
  tipo: string;
  prioridade: "low" | "medium" | "high";
  data_criacao: string;
  status: ContestStatus;
  nome_contestante: string;
  email_contestante: string;
};

// Mock data para demonstração
const mockContestacoes: ContestItem[] = [
  {
    id: "1",
    vistoria_id: "v001",
    imovel: "Apartamento Centro",
    endereco: "Rua das Flores, 123 - Centro",
    tipo: "structural",
    prioridade: "high",
    data_criacao: new Date().toISOString(),
    status: "pendente",
    nome_contestante: "João Silva",
    email_contestante: "joao@email.com"
  },
  {
    id: "2",
    vistoria_id: "v002",
    imovel: "Casa Jardim América",
    endereco: "Av. Brasil, 456 - Jardim América",
    tipo: "electrical",
    prioridade: "medium",
    data_criacao: new Date(Date.now() - 86400000).toISOString(),
    status: "em_analise",
    nome_contestante: "Maria Santos",
    email_contestante: "maria@email.com"
  }
];

export default function ContestacoesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | ContestStatus>("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contestacoes, setContestacoes] = useState<ContestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  // Carregar contestações
  useEffect(() => {
    async function loadContestacoes() {
      setLoading(true);
      // TODO: Implementar busca real da API
      // Por enquanto usando dados mock
      setTimeout(() => {
        setContestacoes(mockContestacoes);
        setLoading(false);
      }, 500);
    }
    loadContestacoes();
  }, []);

  const filtered = useMemo(() => {
    return contestacoes.filter((c) => {
      const matchesQuery = `${c.imovel} ${c.endereco} ${c.nome_contestante} ${c.email_contestante}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = status === "todos" ? true : c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [contestacoes, query, status]);

  const total = filtered.length;
  const kpiPendentes = useMemo(() => filtered.filter((c) => c.status === "pendente").length, [filtered]);
  const kpiAnalise = useMemo(() => filtered.filter((c) => c.status === "em_analise").length, [filtered]);
  const kpiResolvidas = useMemo(() => filtered.filter((c) => c.status === "resolvida").length, [filtered]);
  const kpiRejeitadas = useMemo(() => filtered.filter((c) => c.status === "rejeitada").length, [filtered]);
  
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageIds = useMemo(() => pageItems.map((c) => c.id), [pageItems]);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const getStatusTone = (status: ContestStatus): "amber" | "blue" | "emerald" | "rose" | "zinc" => {
    switch (status) {
      case "pendente": return "amber";
      case "em_analise": return "blue";
      case "resolvida": return "emerald";
      case "rejeitada": return "rose";
      default: return "zinc";
    }
  };

  const getPriorityTone = (priority: "low" | "medium" | "high"): "amber" | "blue" | "emerald" | "rose" | "zinc" => {
    switch (priority) {
      case "low": return "emerald";
      case "medium": return "amber";
      case "high": return "rose";
      default: return "zinc";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Contestações</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Contestações</h1>
          <p className="text-sm text-muted-foreground">Gestão de contestações de laudos</p>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Pendentes" value={kpiPendentes} color="#f59e0b" />
        <KpiCard label="Em Análise" value={kpiAnalise} color="#3b82f6" />
        <KpiCard label="Resolvidas" value={kpiResolvidas} color="#10b981" />
        <KpiCard label="Rejeitadas" value={kpiRejeitadas} color="#ef4444" />
      </section>

      {/* Filtros */}
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 md:col-span-2 flex gap-2">
            <input
              placeholder="Buscar por imóvel, endereço ou contestante"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="flex-1 h-9 px-3 rounded-md border border-input bg-background"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
              className="h-9 px-2 rounded-md border border-input bg-background"
            >
              <option value="todos">Todos status</option>
              <option value="pendente">Pendente</option>
              <option value="em_analise">Em Análise</option>
              <option value="resolvida">Resolvida</option>
              <option value="rejeitada">Rejeitada</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">{total} resultados</span>
          </div>
        </div>
        {/* Quick chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Filtros rápidos por status">
          <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos</button>
          <button className={`px-2 py-1 rounded-md border ${status === "pendente" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("pendente"); setPage(1); }}>Pendentes</button>
          <button className={`px-2 py-1 rounded-md border ${status === "em_analise" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("em_analise"); setPage(1); }}>Em Análise</button>
          <button className={`px-2 py-1 rounded-md border ${status === "resolvida" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("resolvida"); setPage(1); }}>Resolvidas</button>
          <button className={`px-2 py-1 rounded-md border ${status === "rejeitada" ? "bg-rose-500/15 border-rose-500/30 text-rose-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("rejeitada"); setPage(1); }}>Rejeitadas</button>
        </div>
      </SectionCard>

      {/* Lista */}
      <SectionCard title="Lista de contestações" subtitle={loading ? "Carregando..." : `${total} contestações`}>
        {/* Bulk actions toolbar */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <div className="text-muted-foreground">{selected.size} selecionada(s)</div>
          <div className="flex gap-2">
            <button 
              className="px-2 py-1.5 rounded-md border border-border disabled:opacity-50" 
              disabled={selected.size === 0} 
              onClick={() => {
                if (selected.size > 0) {
                  const selectedIds = Array.from(selected);
                  alert(`Exportando ${selectedIds.length} contestações selecionadas`);
                }
              }}
            >
              Exportar seleção
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAllOnPage}
                    className="rounded border-border"
                    aria-label="Selecionar todas as contestações da página"
                  />
                </th>
                <th className="text-left py-2 px-2">Imóvel</th>
                <th className="text-left py-2 px-2">Contestante</th>
                <th className="text-left py-2 px-2">Tipo</th>
                <th className="text-left py-2 px-2">Prioridade</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Data</th>
                <th className="text-left py-2 pl-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Carregando contestações...
                    </div>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma contestação encontrada
                  </td>
                </tr>
              ) : (
                pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="rounded border-border"
                        aria-label={`Selecionar contestação ${c.id}`}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <div>
                        <div className="font-medium">{c.imovel}</div>
                        <div className="text-xs text-muted-foreground">{c.endereco}</div>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div>
                        <div className="font-medium">{c.nome_contestante}</div>
                        <div className="text-xs text-muted-foreground">{c.email_contestante}</div>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className="capitalize">{c.tipo}</span>
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge tone={getPriorityTone(c.prioridade)}>
                        {c.prioridade}
                      </StatusBadge>
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge tone={getStatusTone(c.status)}>
                        {c.status.replace('_', ' ')}
                      </StatusBadge>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {formatDate(c.data_criacao)}
                    </td>
                    <td className="py-2 pl-2">
                      <a
                        href={`/contestoes/${c.id}`}
                        className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30"
                      >
                        Ver detalhes
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Página {currentPage} de {totalPages} ({total} total)
            </div>
            <div className="flex gap-1">
              <button
                className="px-2 py-1.5 rounded-md border border-border disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                Anterior
              </button>
              <button
                className="px-2 py-1.5 rounded-md border border-border disabled:opacity-50"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}