"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";

type ContStatus = "aberta" | "em_analise" | "aceita" | "rejeitada";

type TimelineItem = {
  label: string;
  at: string; // ISO
};

type Detail = {
  id: string;
  protocolo: string;
  vistoriaId: string;
  imovel: string;
  autor: string;
  status: ContStatus;
  criada_em: string;
  timeline: TimelineItem[];
  motivo?: string;
  descricao?: string;
};

export default function ContestacaoDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar detalhes da contestação do Supabase
  useEffect(() => {
    async function fetchContestacaoDetail() {
      setLoading(true);
      try {
        const { data: contestacao, error } = await supabase
          .from('contestacoes')
          .select(`
            id,
            protocolo,
            status,
            motivo,
            descricao,
            created_at,
            updated_at,
            vistoria_id,
            vistorias(
              id,
              imoveis!inner(
                endereco,
                tipo,
                codigo
              )
            ),
            profiles(
              nome
            )
          `)
          .eq('id', params.id)
          .single();

        if (error) {
          // Error handled silently for production
          setLoading(false);
          return;
        }

        if (contestacao) {
          const contestacaoDetail: Detail = {
            id: contestacao.id.toString(),
            protocolo: contestacao.protocolo || `CT-${contestacao.id}`,
            vistoriaId: contestacao.vistoria_id?.toString() || 'N/A',
            imovel: (contestacao.vistorias as any)?.imoveis?.endereco || 'Imóvel não informado',
            autor: (contestacao.profiles as any)?.nome || 'Autor não informado',
            status: contestacao.status as ContStatus,
            criada_em: contestacao.created_at,
            motivo: contestacao.motivo,
            descricao: contestacao.descricao,
            timeline: [
              { label: 'Contestação aberta', at: contestacao.created_at },
              { label: 'Última atualização', at: contestacao.updated_at }
            ]
          };

          // Adicionar eventos da timeline baseados no status
          if (contestacao.status === 'em_analise') {
            contestacaoDetail.timeline.push({
              label: 'Análise iniciada',
              at: contestacao.updated_at
            });
          } else if (contestacao.status === 'aceita') {
            contestacaoDetail.timeline.push({
              label: 'Contestação aceita',
              at: contestacao.updated_at
            });
          } else if (contestacao.status === 'rejeitada') {
            contestacaoDetail.timeline.push({
              label: 'Contestação rejeitada',
              at: contestacao.updated_at
            });
          }

          setData(contestacaoDetail);
        }
      } catch (error) {
        // Error handled silently for production
      }
      setLoading(false);
    }

    fetchContestacaoDetail();
  }, [params.id]);

  // Função para atualizar status da contestação
  const updateStatus = async (newStatus: ContStatus) => {
    if (!data) return;

    try {
      const { error } = await supabase
        .from('contestacoes')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (error) {
        return;
      }

      // Recarregar dados
      window.location.reload();
    } catch (error) {
      // Error handled silently for production
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="text-center py-10">
          <h1 className="text-2xl font-semibold mb-2">Contestação não encontrada</h1>
          <p className="text-muted-foreground">A contestação solicitada não foi encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Contestação {data.protocolo}</h1>
          <p className="text-sm text-muted-foreground">Vistoria #{data.vistoriaId} • {data.imovel}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/contestoes" className="px-3 py-2 rounded-md border border-border hover:bg-muted/30 text-sm">Voltar</Link>
          <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">Baixar PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="font-medium mb-2">Resumo</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Autor</div>
              <div>{data.autor}</div>
              <div className="text-muted-foreground">Status</div>
              <div className="capitalize">{data.status.replace("_", " ")}</div>
              <div className="text-muted-foreground">Criada em</div>
              <div>{new Date(data.criada_em).toLocaleString("pt-BR")}</div>
              {data.motivo && (
                <>
                  <div className="text-muted-foreground">Motivo</div>
                  <div>{data.motivo}</div>
                </>
              )}
            </div>
            {data.descricao && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">Descrição</div>
                <div className="text-sm">{data.descricao}</div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="font-medium mb-3">Timeline</h3>
            <ol className="relative border-s border-border ps-4">
              {data.timeline.map((t, i) => (
                <li key={i} className="mb-5 ms-2">
                  <span className="absolute -start-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString("pt-BR")}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="font-medium mb-2">Anexos</h3>
            <div className="text-sm text-muted-foreground mb-3">Envie evidências para complementar a contestação.</div>
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <div className="text-sm">Arraste e solte arquivos aqui</div>
              <div className="text-xs text-muted-foreground">ou</div>
              <button className="mt-2 px-3 py-1.5 rounded-md border border-border text-sm">Selecionar arquivos</button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Funcionalidade de anexos será implementada em breve.
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="font-medium mb-2">Ações</h3>
            <div className="flex flex-wrap gap-2">
              {data.status === 'aberta' && (
                <>
                  <button 
                    onClick={() => updateStatus('em_analise')}
                    className="px-3 py-2 rounded-md border border-border text-sm hover:bg-muted/30"
                  >
                    Iniciar Análise
                  </button>
                </>
              )}
              {data.status === 'em_analise' && (
                <>
                  <button 
                    onClick={() => updateStatus('aceita')}
                    className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                  >
                    Aprovar
                  </button>
                  <button 
                    onClick={() => updateStatus('rejeitada')}
                    className="px-3 py-2 rounded-md bg-rose-600 text-white text-sm hover:bg-rose-700"
                  >
                    Rejeitar
                  </button>
                </>
              )}
              <button className="px-3 py-2 rounded-md border border-border text-sm hover:bg-muted/30">
                Solicitar mais infos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
