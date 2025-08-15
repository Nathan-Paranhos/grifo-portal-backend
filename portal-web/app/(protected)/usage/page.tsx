"use client";
import { useMemo, useState, useEffect } from "react";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import { supabase } from "../../../lib/supabase";

type Modulo = "dashboard" | "vistorias" | "imoveis" | "usuarios" | "contestoes" | "empresas" | "pdf";
type Acao = "view" | "create" | "update" | "delete" | "download";

type UsageRow = {
  id: string;
  data: string; // ISO
  modulo: Modulo;
  acao: Acao;
  empresa: string;
  quantidade: number;
};

const MODS: Modulo[] = ["dashboard", "vistorias", "imoveis", "usuarios", "contestoes", "empresas", "pdf"];
const ACOES: Acao[] = ["view", "create", "update", "delete", "download"];

export default function UsagePage() {
  const [periodo, setPeriodo] = useState<"7d" | "30d" | "90d">("30d");
  const [modulo, setModulo] = useState<"todos" | Modulo>("todos");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 12;

  const days = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
  const since = new Date(Date.now() - (days - 1) * 86_400_000);

  // Carregar dados de uso do Supabase
  useEffect(() => {
    async function fetchUsageData() {
      setLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from('usage_logs')
          .select(`
            id,
            created_at,
            modulo,
            acao,
            quantidade,
            empresas(
              nome
            )
          `)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar dados de uso:', error);
          return;
        }

        const usageFormatado: UsageRow[] = logs?.map(log => ({
          id: log.id.toString(),
          data: log.created_at,
          modulo: log.modulo as Modulo,
          acao: log.acao as Acao,
          empresa: (log.empresas as any)?.nome || 'Empresa não informada',
          quantidade: log.quantidade || 1
        })) || [];

        setItems(usageFormatado);
      } catch (error) {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    }

    fetchUsageData();
  }, [periodo, since]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      const modOk = modulo === "todos" ? true : r.modulo === modulo;
      const text = `${r.modulo} ${r.acao} ${r.empresa}`.toLowerCase();
      const qOk = text.includes(busca.toLowerCase());
      return modOk && qOk;
    });
  }, [items, modulo, busca]);

  const total = filtered.length;
  const sumQuantidade = useMemo(() => filtered.reduce((acc, r) => acc + r.quantidade, 0), [filtered]);
  const distinctEmpresas = useMemo(() => new Set(filtered.map((r) => r.empresa)).size, [filtered]);
  const distinctModulos = useMemo(() => new Set(filtered.map((r) => r.modulo)).size, [filtered]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  function exportCSV() {
    const hdr = ["data", "modulo", "acao", "empresa", "quantidade"];
    const lines = [hdr.join(",")].concat(
      filtered.map((r) => [
        new Date(r.data).toISOString(),
        r.modulo,
        r.acao,
        r.empresa.replaceAll(",", " "),
        r.quantidade.toString(),
      ].join(","))
    );
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage_${periodo}_${modulo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Uso</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Uso</h1>
          <p className="text-sm text-muted-foreground">{loading ? 'Carregando...' : 'Relatórios e estatísticas'}</p>
        </div>
        <Tooltip content="Exportar CSV">
          <button onClick={exportCSV} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/30">Exportar CSV</button>
        </Tooltip>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Operações (soma)" value={sumQuantidade} delta={undefined} icon={<span aria-hidden>{/* no icon */}</span>} color="#f59e0b">
          <div className="h-8 flex items-end gap-1 opacity-80" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => {
              const h = 20 + ((i * 7) % 40);
              return <div key={i} className="flex-1 bg-muted rounded-sm" style={{ height: `${h}%`, backgroundColor: "#f59e0b" }} />;
            })}
          </div>
        </KpiCard>
        <KpiCard label="Empresas (distintas)" value={distinctEmpresas} color="#3b82f6" />
        <KpiCard label="Módulos (distintos)" value={distinctModulos} color="#10b981" />
      </section>

      {/* Filtros */}
      <SectionCard title="Filtros" subtitle={`${total} registros`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={periodo} onChange={(e) => { setPeriodo(e.target.value as any); setPage(1); }} className="h-9 px-2 rounded-md border border-input bg-background">
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <select value={modulo} onChange={(e) => { setModulo(e.target.value as any); setPage(1); }} className="h-9 px-2 rounded-md border border-input bg-background capitalize">
            <option value="todos">Todos módulos</option>
            {MODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} placeholder="Buscar por empresa/ação" className="h-9 px-3 rounded-md border border-input bg-background" />
          <div className="flex items-center justify-end text-sm text-muted-foreground">{total} registros</div>
        </div>
      </SectionCard>

      {/* Tabela (md+) e Cards (mobile) */}
      <SectionCard title="Registros de uso" subtitle={loading ? "Carregando..." : "Dados reais"}>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-2" role="list" aria-label="Registros de uso (lista)">
          {rows.map((r) => (
            <div key={r.id} role="listitem" className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Data</div>
                  <div className="font-mono tabular-nums">{new Date(r.data).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Qtd</div>
                  <div className="font-mono tabular-nums">{r.quantidade}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Módulo</div>
                  <div className="capitalize">{r.modulo}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Ação</div>
                  <div>{r.acao}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] text-muted-foreground">Empresa</div>
                  <div>{r.empresa}</div>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="rounded-lg border border-border p-6 text-center text-muted-foreground">Sem dados para os filtros atuais.</div>
          )}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <colgroup>
              <col className="w-[120px] bg-muted/20" />
              <col />
              <col />
              <col className="bg-muted/10" />
              <col className="w-[80px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b bg-card/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <tr>
                <th scope="col" className="text-left font-medium px-3 py-2.5">Data</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5 border-l border-border/60">Módulo</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5 border-l border-border/60">Ação</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5 border-l border-border/60">Empresa</th>
                <th scope="col" className="text-right font-medium px-3 py-2.5 border-l border-border/60">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/5 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono tabular-nums">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 capitalize border-l border-border/60">{r.modulo}</td>
                  <td className="px-3 py-2 border-l border-border/60">{r.acao}</td>
                  <td className="px-3 py-2 border-l border-border/60">{r.empresa}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums border-l border-border/60">{r.quantidade}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground" aria-live="polite">Sem dados para os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Paginação */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Página {current} de {totalPages}</div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50" disabled={current <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
            <button className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50" disabled={current >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
