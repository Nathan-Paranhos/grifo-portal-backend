"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { clientApiService } from '@/lib/client-api';

interface InspectionRequest {
  id?: string;
  client_id: string;
  property_address: string;
  property_type: string;
  requested_date?: string;
  status: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface InspectionFile {
  id: string;
  inspection_request_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  author_type: 'client' | 'admin';
  author_name: string;
  created_at: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const statusLabels = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada'
};

const propertyTypeLabels = {
  residential: 'Residencial',
  commercial: 'Comercial',
  industrial: 'Industrial',
  rural: 'Rural',
  other: 'Outro'
};

// Função removida pois file_size não está mais disponível

export default function SolicitacaoDetalhesPage() {
  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [files, setFiles] = useState<InspectionFile[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  const loadData = async () => {
    try {
      // Verificar autenticação
      if (!clientApiService.isAuthenticated()) {
        router.push('/cliente/login');
        return;
      }

      // Carregar detalhes da solicitação
      const requestResponse = await clientApiService.getInspectionRequest(requestId);
      if (requestResponse.success && requestResponse.data) {
        setRequest(requestResponse.data);
      } else {
        setError('Solicitação não encontrada');
        return;
      }

      // Carregar arquivos
      const filesResponse = await clientApiService.getInspectionFiles(requestId);
      if (filesResponse.success) {
        setFiles(filesResponse.data || []);
      }

      // Carregar comentários
      const commentsResponse = await clientApiService.getInspectionComments(requestId);
      if (commentsResponse.success) {
        setComments(commentsResponse.data || []);
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await clientApiService.addInspectionComment(requestId, newComment.trim());
      if (response.success) {
        setNewComment('');
        // Recarregar comentários
        const commentsResponse = await clientApiService.getInspectionComments(requestId);
        if (commentsResponse.success) {
          setComments(commentsResponse.data || []);
        }
      } else {
        setError('Erro ao adicionar comentário');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await clientApiService.downloadFile(fileId);
      if (response.success && response.data) {
        // Criar link de download
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Erro ao baixar arquivo');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link
            href="/cliente/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/cliente/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Detalhes da Solicitação</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {request && (
          <>
            {/* Informações da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Informações da Solicitação</h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  statusColors[request.status as keyof typeof statusColors]
                }`}>
                  {statusLabels[request.status as keyof typeof statusLabels]}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Endereço do Imóvel</h3>
                  <p className="text-sm text-gray-900">{request.property_address}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Tipo do Imóvel</h3>
                  <p className="text-sm text-gray-900">
                    {propertyTypeLabels[request.property_type as keyof typeof propertyTypeLabels] || request.property_type}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Data de Criação</h3>
                  <p className="text-sm text-gray-900">
                    {request.created_at ? new Date(request.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
                
                {request.requested_date && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Data Solicitada</h3>
                    <p className="text-sm text-gray-900">
                      {new Date(request.requested_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
              
              {request.description && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Descrição</h3>
                  <p className="text-sm text-gray-900">{request.description}</p>
                </div>
              )}
            </div>

            {/* Arquivos */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Arquivos da Vistoria</h2>
              
              {files.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">Nenhum arquivo disponível ainda.</p>
                  <p className="text-sm text-gray-400 mt-1">Os arquivos serão disponibilizados após a vistoria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {file.file_type} • {new Date(file.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadFile(file.id, file.file_name)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Baixar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comentários */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Comentários</h2>
              
              {/* Lista de Comentários */}
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum comentário ainda.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-gray-200 pl-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{comment.author_name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          comment.author_type === 'admin' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {comment.author_type === 'admin' ? 'Equipe' : 'Você'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              
              {/* Adicionar Comentário */}
              <form onSubmit={handleAddComment} className="border-t pt-4">
                <div className="mb-3">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Adicionar Comentário
                  </label>
                  <textarea
                    id="comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite seu comentário..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingComment ? 'Enviando...' : 'Enviar Comentário'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}