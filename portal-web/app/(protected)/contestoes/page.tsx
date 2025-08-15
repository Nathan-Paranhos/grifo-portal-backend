"use client";
import Link from "next/link";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useMemo, useState, useEffect } from "react";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import { supabase } from "../../../lib/supabase";

type ContStatus = "aberta" | "em_analise" | "aceita" | "rejeitada";
type Contestacao = {
  id: string;
  protocolo: string;
  vistoriaId: string;
  imovel: string;
  autor: string;
  status: ContStatus;
  criada_em: string; // ISO
};



export default function ContestoesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | ContStatus>("todos");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Contestacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Contestacao | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const pageSize = 10;

  // Carregar contestações do Supabase
  useEffect(() => {
    async function fetchContestacoes() {
      setLoading(true);
      try {
        const { data: contestacoes, error } = await supabase
          .from('contestacoes')
          .select(`
            id,
            protocolo,
            vistoria_id,
            status,
            created_at,
            vistorias(
              id,
              imoveis(
                endereco
              )
            ),
            profiles(
              nome
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          return;
        }

        const contestacoesFormatadas: Contestacao[] = contestacoes?.map(c => ({
          id: c.id.toString(),
          protocolo: c.protocolo || `CT-${c.id}`,
          vistoriaId: c.vistoria_id?.toString() || '',
          imovel: (c.vistorias as any)?.imoveis?.endereco || 'Endereço não informado',
          autor: (c.profiles as any)?.nome || 'Autor não informado',
          status: c.status as ContStatus,
          criada_em: c.created_at
        })) || [];

        setItems(contestacoesFormatadas);
      } catch (error) {
      }
      setLoading(false);
    }

    fetchContestacoes();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = `${c.protocolo} ${c.imovel} ${c.autor}`.toLowerCase();
      const matchesQ = q.includes(query.toLowerCase());
      const matchesStatus = status === "todos" ? true : c.status === status;
      return matchesQ && matchesStatus;
    });
  }, [items, query, status]);

  const total = filtered.length;
  const kpiAbertas = useMemo(() => filtered.filter((c) => c.status === "aberta").length, [filtered]);
  const kpiAnalise = useMemo(() => filtered.filter((c) => c.status === "em_analise").length, [filtered]);
  const kpiRejeitadas = useMemo(() => filtered.filter((c) => c.status === "rejeitada").length, [filtered]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function statusBadge(s: ContStatus) {
    const tone: Record<ContStatus, "amber" | "blue" | "emerald" | "rose"> = {
      aberta: "amber",
      em_analise: "blue",
      aceita: "emerald",
      rejeitada: "rose",
    };
    const icon: Record<ContStatus, JSX.Element> = {
      aberta: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm1-7V7h-2v8h2Zm0 4v-2h-2v2h2Z" />
        </svg>
      ),
      em_analise: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M10 3a7 7 0 1 1 5.29 11.6l4.56 4.55-1.42 1.42-4.55-4.56A7 7 0 0 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
        </svg>
      ),
      aceita: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ),
      rejeitada: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59Z" />
        </svg>
      ),
    };
    return (
      <StatusBadge tone={tone[s]} leftIcon={icon[s]}>
        {s.replace("_", " ")}
      </StatusBadge>
    );
  }

  function askRemove(c: Contestacao) {
    setToDelete(c);
  }
  async function confirmRemove() {
    if (!toDelete) return;
    
    try {
      const { error } = await supabase
        .from('contestacoes')
        .delete()
        .eq('id', toDelete.id);

      if (error) {
        setToast({ message: "Erro ao excluir contestação", tone: "error" });
        return;
      }

      setItems((prev) => prev.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
      setToast({ message: "Contestação excluída", tone: "success" });
    } catch (error) {
      setToast({ message: "Erro ao excluir contestação", tone: "error" });
    }
    
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
          <li aria-current="page" className="text-foreground">Contestações</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Contestações</h1>
          <p className="text-sm text-muted-foreground">{loading ? 'Carregando...' : 'Lista com filtros e paginação'}</p>
        </div>
        <Tooltip content="Ver guia de políticas">
          <a href="#" className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/30">Guia</a>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Abertas" value={kpiAbertas} color="#f59e0b" />
        <KpiCard label="Em análise" value={kpiAnalise} color="#3b82f6" />
        <KpiCard label="Rejeitadas" value={kpiRejeitadas} color="#ef4444" />
      </section>

      {/* Filtros */}
      <SectionCard title="Filtros" subtitle={`${total} resultados`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Buscar por protocolo, imóvel ou autor"
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
            <option value="aberta">Aberta</option>
            <option value="em_analise">Em análise</option>
            <option value="aceita">Aceita</option>
            <option value="rejeitada">Rejeitada</option>
          </select>
          <div className="flex items-center justify-end text-sm text-muted-foreground">{total} resultados</div>
        </div>
        {/* Quick chips status */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Filtros rápidos por status">
          <button className={`px-2 py-1 rounded-md border ${status === "todos" ? "bg-muted/30" : "hover:bg-muted/20"}`} onClick={() => { setStatus("todos"); setPage(1); }}>Todos</button>
          <button className={`px-2 py-1 rounded-md border ${status === "aberta" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("aberta"); setPage(1); }}>Abertas</button>
          <button className={`px-2 py-1 rounded-md border ${status === "em_analise" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("em_analise"); setPage(1); }}>Em análise</button>
          <button className={`px-2 py-1 rounded-md border ${status === "aceita" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("aceita"); setPage(1); }}>Aceitas</button>
          <button className={`px-2 py-1 rounded-md border ${status === "rejeitada" ? "bg-rose-500/15 border-rose-500/30 text-rose-300" : "hover:bg-muted/20"}`} onClick={() => { setStatus("rejeitada"); setPage(1); }}>Rejeitadas</button>
        </div>
      </SectionCard>

      {/* Lista */}
      <SectionCard title="Lista de contestações" subtitle={loading ? "Carregando..." : "Dados reais"}>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {pageItems.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
              Nenhum registro encontrado com os filtros atuais.
            </div>
          ) : (
            pageItems.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono text-muted-foreground">{c.protocolo}</div>
                    <div className="mt-1 text-sm font-medium leading-5">{c.imovel}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/contestoes/${c.id}`} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30 inline-block" aria-label={`Abrir contestação ${c.protocolo}`}>Abrir</Link>
                    <button onClick={() => askRemove(c)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10" aria-label={`Excluir contestação ${c.protocolo}`}>Excluir</button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                  <div><span className="sr-only">Autor:</span>{c.autor}</div>
                  <div className="mt-1"><span className="sr-only">Status:</span>{statusBadge(c.status)}</div>
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
                  <Tooltip content="Número de protocolo"><span>Protocolo</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Imóvel relacionado"><span>Imóvel</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Quem abriu a contestação"><span>Autor</span></Tooltip>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">
                  <Tooltip content="Situação atual"><span>Status</span></Tooltip>
                </th>
                <th scope="col" className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-sm text-muted-foreground" colSpan={5} aria-live="polite">
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.protocolo}</td>
                    <td className="px-3 py-2">{c.imovel}</td>
                    <td className="px-3 py-2">{c.autor}</td>
                    <td className="px-3 py-2">{statusBadge(c.status)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/contestoes/${c.id}`} className="px-2 py-1.5 rounded-md border border-border hover:bg-muted/30 inline-block" aria-label={`Abrir contestação ${c.protocolo}`}>Abrir</Link>
                        <button onClick={() => askRemove(c)} className="px-2 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10" aria-label={`Excluir contestação ${c.protocolo}`}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {toDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={cancelRemove} role="dialog" aria-modal="true" aria-labelledby="dialog-contestoes-remove-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 id="dialog-contestoes-remove-title" className="text-lg font-medium mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-muted-foreground mb-4">Tem certeza que deseja excluir &quot;{toDelete.protocolo}&quot;?</p>
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
