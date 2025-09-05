"use client";
import React, { useMemo, useState, useEffect } from "react";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Tooltip } from "../../../components/ui/Tooltip";
import grifoPortalApiService, { Inspection } from "../../../lib/api";
import { Plus, Edit, Trash2 } from "lucide-react";
import NovaVistoriaModal from "./components/NovaVistoriaModal";
import EditarVistoriaModal from "./components/EditarVistoriaModal";

// Força renderização dinâmica para esta página
export const dynamic = 'force-dynamic'

type VisStatus = "agendada" | "em_andamento" | "concluida" | "contestada";
type VisItem = {
  id: string;
  imovel: string;
  endereco: string;
  corretor: string;
  data: string; // ISO date
  status: VisStatus;
};

// Dados mockados para teste das funcionalidades
const mockVistorias: VisItem[] = [
  {
    id: '1',
    imovel: 'Apartamento 3 quartos',
    endereco: 'Rua das Flores, 123 - Copacabana, RJ',
    corretor: 'João Silva',
    data: '2024-01-25T09:00:00Z',
    status: 'agendada'
  },
  {
    id: '2',
    imovel: 'Casa 4 quartos',
    endereco: 'Av. Atlântica, 456 - Ipanema, RJ',
    corretor: 'Maria Santos',
    data: '2024-01-24T14:00:00Z',
    status: 'em_andamento'
  },
  {
    id: '3',
    imovel: 'Studio moderno',
    endereco: 'Rua Barata Ribeiro, 789 - Copacabana, RJ',
    corretor: 'Pedro Costa',
    data: '2024-01-23T10:30:00Z',
    status: 'concluida'
  },
  {
    id: '4',
    imovel: 'Cobertura duplex',
    endereco: 'Av. Vieira Souto, 321 - Ipanema, RJ',
    corretor: 'Ana Oliveira',
    data: '2024-01-22T16:00:00Z',
    status: 'contestada'
  },
  {
    id: '5',
    imovel: 'Apartamento 2 quartos',
    endereco: 'Rua Visconde de Pirajá, 654 - Ipanema, RJ',
    corretor: 'Carlos Ferreira',
    data: '2024-01-26T11:00:00Z',
    status: 'agendada'
  },
  {
    id: '6',
    imovel: 'Casa térrea',
    endereco: 'Rua General Urquiza, 987 - Leblon, RJ',
    corretor: 'Lucia Mendes',
    data: '2024-01-27T15:30:00Z',
    status: 'agendada'
  },
  {
    id: '7',
    imovel: 'Loft industrial',
    endereco: 'Rua do Catete, 147 - Catete, RJ',
    corretor: 'Roberto Lima',
    data: '2024-01-21T13:00:00Z',
    status: 'concluida'
  },
  {
    id: '8',
    imovel: 'Apartamento 1 quarto',
    endereco: 'Rua Siqueira Campos, 258 - Copacabana, RJ',
    corretor: 'Fernanda Rocha',
    data: '2024-01-28T09:30:00Z',
    status: 'em_andamento'
  },
  {
    id: '9',
    imovel: 'Casa de vila',
    endereco: 'Rua Jardim Botânico, 369 - Jardim Botânico, RJ',
    corretor: 'Marcos Alves',
    data: '2024-01-29T14:30:00Z',
    status: 'agendada'
  },
  {
    id: '10',
    imovel: 'Apartamento cobertura',
    endereco: 'Av. Nossa Senhora de Copacabana, 741 - Copacabana, RJ',
    corretor: 'Juliana Barbosa',
    data: '2024-01-20T10:00:00Z',
    status: 'contestada'
  },
  {
    id: '11',
    imovel: 'Sala comercial',
    endereco: 'Av. Rio Branco, 852 - Centro, RJ',
    corretor: 'Eduardo Nascimento',
    data: '2024-01-30T08:00:00Z',
    status: 'agendada'
  },
  {
    id: '12',
    imovel: 'Apartamento 3 quartos',
    endereco: 'Rua Prudente de Morais, 963 - Ipanema, RJ',
    corretor: 'Camila Torres',
    data: '2024-01-19T17:00:00Z',
    status: 'concluida'
  }
];

// Função para buscar vistorias da API
async function fetchVistorias(): Promise<VisItem[]> {
  try {
    // Temporariamente retornando dados mockados para teste
    // TODO: Implementar chamada real à API quando autenticação estiver configurada
    return mockVistorias;
    
    // Código original comentado:
    // const response = await grifoPortalApiService.getInspections();
    // if (!response.success || !response.data) {
    //   return [];
    // }
    // return response.data.map(inspection => ({
    //   id: inspection.id || '',
    //   imovel: 'Imóvel',
    //   endereco: 'Endereço não informado',
    //   corretor: 'Não informado',
    //   data: inspection.created_at || new Date().toISOString(),
    //   status: (inspection.status as VisStatus) || 'agendada'
    // }));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch inspections:', error instanceof Error ? error.message : error);
    }
    return mockVistorias; // Fallback para dados mockados
  }
}

export default function VistoriasPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | VisStatus>("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vistorias, setVistorias] = useState<VisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditarVistoriaModal, setShowEditarVistoriaModal] = useState(false);
  const [vistoriaParaEditar, setVistoriaParaEditar] = useState<Inspection | null>(null);
  const [vistoriaParaExcluir, setVistoriaParaExcluir] = useState<Inspection | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const handleExcluirVistoria = (vistoria: Inspection) => {
    setVistoriaParaExcluir(vistoria);
  };

  const confirmRemove = async () => {
    if (!vistoriaParaExcluir) return;
    
    try {
      // Aqui seria a chamada para a API de exclusão
      // await grifoPortalApiService.deleteInspection(vistoriaParaExcluir.id);
      
      // Por enquanto, apenas remove da lista local
      setVistorias(prev => prev.filter(v => v.id !== vistoriaParaExcluir.id));
      
      setVistoriaParaExcluir(null);
      setToast({ message: "Vistoria excluída com sucesso", tone: "success" });
      setTimeout(() => setToast(null), 3000);
      
      // Recarregar as vistorias após exclusão
      await fetchVistorias();
    } catch (error) {
      console.error('Erro ao excluir vistoria:', error);
      setToast({ message: "Erro ao excluir vistoria", tone: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const cancelRemove = () => {
    setVistoriaParaExcluir(null);
  };
  const pageSize = 10;

  // Carregar vistorias do Supabase
  useEffect(() => {
    async function loadVistorias() {
      setLoading(true);
      const data = await fetchVistorias();
      setVistorias(data);
      setLoading(false);
    }
    loadVistorias();
  }, []);

  const filtered = useMemo(() => {
    return vistorias.filter((v) => {
      const matchesQuery = `${v.imovel} ${v.endereco} ${v.corretor}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = status === "todos" ? true : v.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [vistorias, query, status]);

  const total = filtered.length;
  const kpiAgendadas = useMemo(() => filtered.filter((v) => v.status === "agendada").length, [filtered]);
  const kpiAndamento = useMemo(() => filtered.filter((v) => v.status === "em_andamento").length, [filtered]);
  const kpiContestadas = useMemo(() => filtered.filter((v) => v.status === "contestada").length, [filtered]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageIds = useMemo(() => pageItems.map((v) => v.id), [pageItems]);
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

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Vistorias</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Vistorias</h1>
          <p className="text-sm text-muted-foreground">Gestão de vistorias imobiliárias</p>
        </div>
        <Tooltip content="Criar nova vistoria">
          <button
            className="h-9 inline-flex items-center rounded-md border border-gray-200 px-3 text-sm hover:bg-muted/30"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova vistoria
          </button>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Agendadas" value={kpiAgendadas} color="#3b82f6" />
        <KpiCard label="Em andamento" value={kpiAndamento} color="#f59e0b" />
        <KpiCard label="Contestadas" value={kpiContestadas} color="#ef4444" />
      </section>

      {/* Filtros */}
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 md:col-span-2 flex gap-2">
            <input
              placeholder="Buscar por imóvel, endereço ou corretor"
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
              <option value="agendada">Agendada</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
              <option value="contestada">Contestada</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">{total} resultados</span>
          </div>
        </div>
        {/* Quick chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Filtros rápidos por status">
          <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos</button>
          <button className={`px-2 py-1 rounded-md border ${status === "agendada" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("agendada"); setPage(1); }}>Agendadas</button>
          <button className={`px-2 py-1 rounded-md border ${status === "em_andamento" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("em_andamento"); setPage(1); }}>Em andamento</button>
          <button className={`px-2 py-1 rounded-md border ${status === "concluida" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("concluida"); setPage(1); }}>Concluídas</button>
          <button className={`px-2 py-1 rounded-md border ${status === "contestada" ? "bg-rose-500/15 border-rose-500/30 text-rose-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("contestada"); setPage(1); }}>Contestadas</button>
        </div>
      </SectionCard>

      {/* Lista */}
      <SectionCard title="Lista de vistorias" subtitle={loading ? "Carregando..." : `${total} vistorias`}>
        {/* Bulk actions toolbar */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <div className="text-muted-foreground">{selected.size} selecionada(s)</div>
          <div className="flex gap-2">
            <button 
              className="px-2 py-1.5 rounded-md border border-gray-200 disabled:opacity-50" 
              disabled={selected.size === 0} 
              onClick={() => {
                if (selected.size > 0) {
                  const selectedIds = Array.from(selected);
                  // TODO: Implementar exportação real
                  alert(`Exportando ${selectedIds.length} vistorias selecionadas`);
                }
              }}
            >
              Exportar seleção
            </button>
            <button 
              className="px-2 py-1.5 rounded-md border border-gray-200 disabled:opacity-50" 
              disabled={selected.size === 0} 
              onClick={() => {
                if (selected.size > 0) {
                  const selectedIds = Array.from(selected);
                  // TODO: Implementar ações em massa reais
                  alert(`Ação em massa para ${selectedIds.length} vistorias selecionadas`);
                }
              }}
            >
              Ação em massa
            </button>
          </div>
        </div>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-2" role="list" aria-label="Lista de vistorias (mobile)">
          {pageItems.map((v) => (
            <div key={v.id} role="listitem" className="rounded-lg border border-gray-200 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input aria-label={`Selecionar vistoria ${v.id}`} type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} className="h-4 w-4" />
                  <span className="font-medium">#{v.id}</span>
                </label>
                <a href={`/vistorias/${v.id}`} className="px-2 py-1.5 rounded-md border border-gray-200 hover:bg-muted/30 text-sm">Abrir</a>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2">
                  <div className="text-[11px] text-muted-foreground">Imóvel</div>
                  <div className="font-medium">{v.imovel}</div>
                  <div className="text-muted-foreground text-xs">{v.endereco}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Corretor</div>
                  <div>{v.corretor}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Data</div>
                  <div>{new Date(v.data).toLocaleString()}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] text-muted-foreground">Status</div>
                  <div>
                    {v.status === "agendada" && <StatusBadge tone="blue">Agendada</StatusBadge>}
                    {v.status === "em_andamento" && <StatusBadge tone="amber">Em andamento</StatusBadge>}
                    {v.status === "concluida" && <StatusBadge tone="emerald">Concluída</StatusBadge>}
                    {v.status === "contestada" && <StatusBadge tone="rose">Contestada</StatusBadge>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {pageItems.length === 0 && (
            <div className="rounded-lg border border-gray-200 p-6 text-center text-muted-foreground">Nenhum resultado para os filtros atuais.</div>
          )}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <tr>
                <th scope="col" className="w-10 px-3 py-2.5">
                  <Tooltip content="Selecionar todos nesta página">
                    <input aria-label="Selecionar todos nesta página" type="checkbox" checked={allChecked} onChange={toggleAllOnPage} className="h-4 w-4 align-middle" />
                  </Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Identificador único da vistoria"><span>Vistoria</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Unidade e endereço"><span>Imóvel</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Responsável"><span>Corretor</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Data/hora"><span>Data</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Situação atual"><span>Status</span></Tooltip>
                </th>
                <th scope="col" className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((v) => (
                <tr key={v.id} className="border-t border-gray-200 odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                  <td className="px-3 py-2 align-middle">
                    <input aria-label={`Selecionar vistoria ${v.id}`} type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-2 font-medium">#{v.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{v.imovel}</div>
                    <div className="text-muted-foreground text-xs">{v.endereco}</div>
                  </td>
                  <td className="px-3 py-2">{v.corretor}</td>
                  <td className="px-3 py-2">{new Date(v.data).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {v.status === "agendada" && <StatusBadge tone="blue">Agendada</StatusBadge>}
                    {v.status === "em_andamento" && <StatusBadge tone="amber">Em andamento</StatusBadge>}
                    {v.status === "concluida" && <StatusBadge tone="emerald">Concluída</StatusBadge>}
                    {v.status === "contestada" && <StatusBadge tone="rose">Contestada</StatusBadge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Tooltip content="Editar vistoria">
                        <button
                          onClick={() => {
                            setVistoriaParaEditar(v);
                            setShowEditarVistoriaModal(true);
                          }}
                          className="p-1.5 rounded-md border border-gray-200 hover:bg-muted/30"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Excluir vistoria">
                          <button
                            onClick={() => handleExcluirVistoria(v)}
                            className="p-1.5 rounded-md border border-gray-200 hover:bg-muted/30 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      <a
                        href={`/vistorias/${v.id}`}
                        className="px-2 py-1.5 rounded-md border border-gray-200 hover:bg-muted/30"
                      >
                        Abrir
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum resultado para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button
              className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </SectionCard>
      
      <NovaVistoriaModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          // Recarrega a lista após criar nova vistoria
          async function reloadVistorias() {
            setLoading(true);
            const data = await fetchVistorias();
            setVistorias(data);
            setLoading(false);
          }
          reloadVistorias();
        }}
      />
      
      {vistoriaParaEditar && (
        <EditarVistoriaModal 
          isOpen={showEditarVistoriaModal}
          vistoria={vistoriaParaEditar}
          onClose={() => {
            setShowEditarVistoriaModal(false);
            setVistoriaParaEditar(null);
          }}
          onSuccess={() => {
            setShowEditarVistoriaModal(false);
            setVistoriaParaEditar(null);
            // Recarrega a lista após editar vistoria
            async function reloadVistorias() {
              setLoading(true);
              const data = await fetchVistorias();
              setVistorias(data);
              setLoading(false);
            }
            reloadVistorias();
          }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {vistoriaParaExcluir && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={cancelRemove}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja excluir a vistoria do imóvel &quot;{vistoriaParaExcluir.imovel}&quot;?
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md border border-gray-200" onClick={cancelRemove}>
                Cancelar
              </button>
              <button 
                className="px-3 py-2 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10" 
                onClick={confirmRemove}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificação */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-md px-3 py-2 text-sm shadow-md border ${
          toast.tone === "success" 
            ? "bg-emerald-600 text-white border-emerald-500" 
            : "bg-rose-600 text-white border-rose-500"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
