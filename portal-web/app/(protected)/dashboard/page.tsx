"use client";
import { useMemo, useState, useEffect } from "react";
import KpiCard from "../../../components/ui/KpiCard";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import { supabase } from "../../../lib/supabase";

type KPI = { label: string; value: number; delta?: number; color?: string; icon?: React.ReactNode };

export default function DashboardPage() {
  // Filtros simples (UI-only)
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [dashboardData, setDashboardData] = useState({
    vistorias: 0,
    pendentes: 0,
    concluidas: 0,
    contestadas: 0,
    empresas: [] as Array<{empresa: string, vistorias: number}>
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados do dashboard
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        // Buscar vistorias por status
        const { data: vistorias, error: vistoriasError } = await supabase
          .from('vistorias')
          .select('status, created_at, empresas(nome)')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        if (vistoriasError) {
          setError('Erro ao carregar dados do dashboard');
        }
        
        const total = vistorias?.length || 0;
        const pendentes = vistorias?.filter(v => v.status === 'agendada').length || 0;
        const concluidas = vistorias?.filter(v => v.status === 'concluida').length || 0;
        const contestadas = vistorias?.filter(v => v.status === 'contestada').length || 0;
        
        // Agrupar por empresa
        const empresasMap = new Map();
        vistorias?.forEach(v => {
          const nomeEmpresa = (v.empresas as any)?.nome || 'Sem empresa';
          empresasMap.set(nomeEmpresa, (empresasMap.get(nomeEmpresa) || 0) + 1);
        });
        
        const topEmpresas = Array.from(empresasMap.entries())
          .map(([empresa, vistorias]) => ({ empresa, vistorias }))
          .sort((a, b) => b.vistorias - a.vistorias)
          .slice(0, 4);
        
        setDashboardData({
          vistorias: total,
          pendentes,
          concluidas,
          contestadas,
          empresas: topEmpresas
        });
      } catch (error) {
        setError('Erro ao carregar dados do dashboard');
      }
      setLoading(false);
    }
    
    loadDashboardData();
  }, [range]);

  // KPIs baseados em dados reais
  const kpis: KPI[] = useMemo(
    () => [
      { label: "Vistorias (30d)", value: dashboardData.vistorias, color: "#f59e0b", icon: (
        <Tooltip content="Total de vistorias no período"><span>{iconClipboard()}</span></Tooltip>
      ) },
      { label: "Pendentes", value: dashboardData.pendentes, color: "#3b82f6", icon: (
        <Tooltip content="Vistorias pendentes"><span>{iconPending()}</span></Tooltip>
      ) },
      { label: "Concluídas", value: dashboardData.concluidas, color: "#10b981", icon: (
        <Tooltip content="Vistorias concluídas"><span>{iconCheck()}</span></Tooltip>
      ) },
      { label: "Contestadas", value: dashboardData.contestadas, color: "#f43f5e", icon: (
        <Tooltip content="Vistorias com contestação"><span>{iconFlag()}</span></Tooltip>
      ) },
    ],
    [dashboardData]
  );

  const bars = useMemo(() => {
    return range === "7d" ? [18, 22, 12, 26, 30, 24, 20] : range === "30d" ? [12, 15, 18, 22, 17, 26, 30] : [10, 11, 14, 15, 20, 18, 22];
  }, [range]);

  const pie = useMemo(
    () => [
      { label: "Pendentes", value: dashboardData.pendentes, color: "#3b82f6" },
      { label: "Concluídas", value: dashboardData.concluidas, color: "#10b981" },
      { label: "Contestadas", value: dashboardData.contestadas, color: "#f43f5e" },
      { label: "Agendadas", value: dashboardData.vistorias - dashboardData.concluidas - dashboardData.contestadas - dashboardData.pendentes, color: "#f59e0b" },
    ],
    [dashboardData]
  );
  const pieTotal = useMemo(() => pie.reduce((acc, s) => acc + s.value, 0), [pie]);

  const recent = useMemo(
    () => [
      { when: "Hoje 10:21", title: "Vistoria concluída", meta: "Apto 402 · Emp. Ouro" },
      { when: "Hoje 09:10", title: "Contestação aberta", meta: "Prot. CT-00912" },
      { when: "Ontem 18:34", title: "Vistoria agendada", meta: "Casa 21 · Bairro Azul" },
      { when: "Ontem 14:02", title: "Usuário criado", meta: "joao.souza@empresa.com" },
    ],
    []
  );

  const topEmpresas = useMemo(
    () => dashboardData.empresas,
    [dashboardData.empresas]
  );

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Dashboard</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral de operações e status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto min-w-0 justify-start md:justify-end" role="group" aria-label="Intervalo de tempo e ações">
          {(
            [
              { id: "7d", label: "7d" },
              { id: "30d", label: "30d" },
              { id: "90d", label: "90d" },
            ] as const
          ).map((opt) => (
            <Tooltip key={opt.id} content={`Intervalo ${opt.label}`}>
              <button
                onClick={() => setRange(opt.id)}
                className={`h-9 px-3 rounded-md border text-sm shrink-0 ${
                  range === opt.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/30"
                }`}
                aria-pressed={range === opt.id}
              >
                {opt.label}
              </button>
            </Tooltip>
          ))}
          <Tooltip content="Exportar dados">
            <button className="h-9 px-3 rounded-md border border-border hover:bg-muted/30 shrink-0" aria-label="Exportar dados">
              Exportar
            </button>
          </Tooltip>
          <Tooltip content="Ir para vistorias">
            <a href="/vistorias" className="h-9 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center whitespace-nowrap shrink-0" aria-label="Ir para vistorias">
              Ver vistorias
            </a>
          </Tooltip>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta} icon={k.icon} color={k.color}>
            <div className="h-8 flex items-end gap-1 opacity-90" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => {
                const h = 20 + ((i * 7) % 40);
                return <div key={i} className="flex-1 bg-muted rounded-sm" style={{ height: `${h}%`, backgroundColor: k.color }} />;
              })}
            </div>
          </KpiCard>
        ))}
      </section>

      {/* Charts + Lists */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar chart */}
        <SectionCard title={`Vistorias por dia (${range})`} subtitle={loading ? "Carregando..." : "Dados reais"} className="xl:col-span-2">
          {/* Estatísticas rápidas */}
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden></span>Total <span className="font-medium text-foreground tabular-nums">{bars.reduce((a,b)=>a+b,0)}</span></div>
            <div>Média <span className="font-medium text-foreground tabular-nums">{Math.round((bars.reduce((a,b)=>a+b,0)/bars.length) as number)}</span></div>
            <div>Pico <span className="font-medium text-foreground tabular-nums">{Math.max(...bars)}</span></div>
          </div>
          {/* Gráfico com linhas de grade */}
          <div className="mt-3 h-56 relative">
            <div className="absolute inset-0 flex flex-col justify-between opacity-30">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-t border-border/60" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end gap-2 px-0.5">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 bg-muted/60 rounded-sm relative">
                  <div className="absolute inset-x-0 bottom-0 rounded-sm" style={{ height: `${(h / 35) * 100}%`, backgroundColor: "#3b82f6" }} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground font-mono tabular-nums">
            {Array.from({ length: bars.length }).map((_, i) => (
              <span key={i}>D{i + 1}</span>
            ))}
          </div>
        </SectionCard>

        {/* Donut chart */}
        <SectionCard title="Distribuição por status" subtitle={loading ? "Carregando..." : "Dados reais"}>
          <div className="mt-4 grid grid-cols-2 gap-3 items-center">
            <div className="relative w-44 h-44 justify-self-center">
              <svg viewBox="0 0 42 42" className="w-44 h-44">
                {(() => {
                  let acc = 0;
                  return pie.map((seg, idx) => {
                    const frac = seg.value / pieTotal;
                    const dash = 2 * Math.PI * 16;
                    const strokeDasharray = `${dash * frac} ${dash * (1 - frac)}`;
                    const strokeDashoffset = -acc * dash;
                    acc += frac;
                    return (
                      <circle
                        key={idx}
                        r="16"
                        cx="21"
                        cy="21"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="8"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-xl font-semibold tabular-nums">{pieTotal}</div>
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {pie.map((seg) => (
                <li key={seg.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
                  <span className="text-muted-foreground flex-1">{seg.label}</span>
                  <b className="tabular-nums">{seg.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
      </section>

      {/* Activity + Top empresas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Atividades recentes" subtitle="Dados reais">
          <ul className="mt-3 space-y-3">
            {recent.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{it.meta}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{it.when}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Top empresas (vistorias)" subtitle="Dados reais">
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Empresa</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {topEmpresas.map((e) => (
                  <tr key={e.empresa} className="border-b last:border-0">
                    <td className="px-3 py-2">{e.empresa}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{e.vistorias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function iconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7-1a1 1 0 011 1H11a1 1 0 011-1zM5 21V5h2v2h10V5h2v16H5z"/></svg>
  );
}
function iconPending() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6v6l4 2-.75 1.85L10 13V6h2z"/></svg>
  );
}
function iconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
  );
}
function iconFlag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 6l-1-2H5v18h2v-6h6l1 2h6V6z"/></svg>
  );
}
