"use client";
import { useState, useEffect } from "react";
import grifoPortalApiService from "../../../../lib/api";
import { Upload, X } from "lucide-react";

type Props = { params: { id: string } };

type VisStatus = "agendada" | "em_andamento" | "concluida" | "contestada";

type VistoriaDetail = {
  base: {
    id: string;
    imovel: string;
    endereco: string;
    corretor: string;
    status: VisStatus;
    criado_em: string;
    atualizado_em: string;
    data_agendada: string;
  };
  timeline: Array<{ ts: string; label: string }>;
  itens: Array<{ id: number; titulo: string; status: string; nota: string }>;
  fotos: Array<{ id: number; url: string; legenda: string }>;
};

export default function VistoriaDetailPage({ params }: Props) {
  const { id } = params;
  const [data, setData] = useState<VistoriaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"resumo" | "itens" | "fotos" | "pdf">("resumo");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('photos', file);
      });

      const response = await grifoPortalApiService.uploadInspectionPhotos(id, formData);
      
      // Atualizar dados da vistoria com as novas fotos
      if (data) {
        setData({
          ...data,
          fotos: [...data.fotos, ...response.photos]
        });
      }
      
      // Limpar input
      event.target.value = '';
    } catch (error) {
      console.error('Erro ao fazer upload das fotos:', error);
      alert('Erro ao fazer upload das fotos. Tente novamente.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta foto?')) return;

    try {
      await grifoPortalApiService.deleteInspectionPhoto(id, photoId.toString());
      
      // Remover foto dos dados locais
      if (data) {
        setData({
          ...data,
          fotos: data.fotos.filter(f => f.id !== photoId)
        });
      }
    } catch (error) {
      console.error('Erro ao excluir foto:', error);
      alert('Erro ao excluir foto. Tente novamente.');
    }
  };

  // Carregar detalhes da vistoria da API
  useEffect(() => {
    async function fetchVistoriaDetail() {
      setLoading(true);
      try {
        const response = await grifoPortalApiService.getInspection(id);

        if (!response.success || !response.data) {
          setLoading(false);
          return;
        }

        const vistoria = response.data;
        const vistoriaDetail: VistoriaDetail = {
          base: {
            id: vistoria.id || '',
            imovel: 'Imóvel não informado', // property_address não existe no tipo Inspection
            endereco: 'Endereço não informado', // property_address não existe no tipo Inspection
            corretor: 'Corretor não informado', // inspector_name não existe no tipo Inspection
            status: (vistoria.status as VisStatus) || 'agendada',
            criado_em: vistoria.created_at || new Date().toISOString(),
            atualizado_em: vistoria.updated_at || vistoria.created_at || new Date().toISOString(),
            data_agendada: vistoria.created_at || new Date().toISOString() // scheduled_date não existe no tipo Inspection
          },
          timeline: [
            { ts: vistoria.created_at || new Date().toISOString(), label: 'Criada' },
            { ts: vistoria.created_at || new Date().toISOString(), label: 'Agendada' }, // scheduled_date não existe no tipo Inspection
            { ts: vistoria.updated_at || vistoria.created_at || new Date().toISOString(), label: 'Última atualização' }
          ],
          itens: [
            { id: 1, titulo: 'Estrutura', status: 'aprovado', nota: 'Estrutura em bom estado' },
            { id: 2, titulo: 'Instalações elétricas', status: 'pendente', nota: 'Aguardando verificação' },
            { id: 3, titulo: 'Instalações hidráulicas', status: 'aprovado', nota: 'Funcionando corretamente' }
          ],
          fotos: [
            { id: 1, url: '/placeholder-image.jpg', legenda: 'Fachada do imóvel' },
            { id: 2, url: '/placeholder-image.jpg', legenda: 'Área interna' }
          ]
        };

        setData(vistoriaDetail);
      } catch (error) {
        // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load inspection:', error instanceof Error ? error.message : error);
    }
      }
      setLoading(false);
    };

    fetchVistoriaDetail();
  }, [id]);

  const StatusBadge = ({ s }: { s: VisStatus }) => {
    const map: Record<VisStatus, string> = {
      agendada: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      em_andamento: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      concluida: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      contestada: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    };
    return <span className={`px-2 py-0.5 text-xs rounded border ${map[s]}`}>{s.replace("_", " ")}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <div className="text-center py-10">
          <h1 className="text-2xl font-semibold mb-2">Vistoria não encontrada</h1>
          <p className="text-muted-foreground">A vistoria solicitada não foi encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Vistoria #{data.base.id}</h1>
          <p className="text-sm text-muted-foreground">
            {data.base.imovel} — {data.base.endereco}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            className="px-3 py-2 rounded-md border border-border hover:bg-muted/30"
            onClick={() => {
              // TODO: Implementar download de PDF real
              alert('Funcionalidade de download de PDF será implementada em breve');
            }}
          >
            Baixar PDF
          </button>
          <button 
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            onClick={() => {
              // TODO: Implementar contestação real
              alert('Funcionalidade de contestação será implementada em breve');
            }}
          >
            Contestar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 rounded-lg border border-border p-4">
          <div className="flex gap-2 border-b border-border mb-4">
            {(["resumo", "itens", "fotos", "pdf"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                  tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {tab === "resumo" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge s={data.base.status} />
                <span className="text-sm text-muted-foreground">
                  Corretor: <b>{data.base.corretor}</b>
                </span>
                <span className="text-sm text-muted-foreground">
                  Agendada para: {new Date(data.base.data_agendada).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Linha do tempo</h3>
                <ol className="relative border-l border-border ml-3">
                  {data.timeline.map((ev, i) => (
                    <li key={i} className="ml-4 py-2">
                      <div className="absolute w-2 h-2 rounded-full bg-primary -left-1 mt-2" />
                      <time className="text-xs text-muted-foreground">
                        {new Date(ev.ts).toLocaleString()}
                      </time>
                      <div className="text-sm">{ev.label}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {tab === "itens" && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2.5">Item</th>
                    <th className="text-left font-medium px-3 py-2.5">Status</th>
                    <th className="text-left font-medium px-3 py-2.5">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((it) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-3 py-2">{it.titulo}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-xs rounded border border-border">
                          {it.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{it.nota || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "fotos" && (
            <div className="space-y-4">
              {/* Upload de Fotos */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Fotos da Vistoria</h3>
                <div className="relative">
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border ${
                      uploadingPhoto
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer'
                    }`}
                  >
                    {uploadingPhoto ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Adicionar Fotos
                      </>
                    )}
                  </label>
                </div>
              </div>
              
              {/* Grid de Fotos */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.fotos.map((f) => (
                  <figure key={f.id} className="rounded-lg overflow-hidden border border-border relative group">
                    <img src={f.url} alt={f.legenda} className="w-full h-40 object-cover" />
                    <button
                      onClick={() => handleDeletePhoto(f.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Excluir foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <figcaption className="text-xs text-muted-foreground p-2">{f.legenda}</figcaption>
                  </figure>
                ))}
              </div>
              
              {data.fotos.length === 0 && (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">Nenhuma foto adicionada ainda</p>
                  <p className="text-sm text-muted-foreground">Clique em "Adicionar Fotos" para enviar imagens da vistoria</p>
                </div>
              )}
            </div>
          )}

          {tab === "pdf" && (
            <div className="h-[60vh] grid place-items-center border border-dashed border-border rounded-md">
              <div className="text-center">
                <div className="text-lg font-medium mb-1">Visualizador de PDF</div>
                <p className="text-sm text-muted-foreground">
                  PDF será exibido aqui quando disponível.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="mt-1"><StatusBadge s={data.base.status} /></div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Criado em</div>
            <div className="text-sm">{new Date(data.base.criado_em).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Atualizado em</div>
            <div className="text-sm">{new Date(data.base.atualizado_em).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Agendada</div>
            <div className="text-sm">{new Date(data.base.data_agendada).toLocaleString()}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
