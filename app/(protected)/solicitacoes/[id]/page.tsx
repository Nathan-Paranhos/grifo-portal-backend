"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import grifoPortalApiService from '@/lib/api';

interface InspectionRequest {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  property_address: string;
  property_type: string;
  preferred_date?: string;
  description?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assigned_inspector_id?: string;
  assigned_inspector_name?: string;
  created_at: string;
  updated_at: string;
}

interface InspectionFile {
  id: string;
  inspection_request_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface Comment {
  id: string;
  inspection_request_id: string;
  user_id: string;
  user_name: string;
  user_type: 'client' | 'inspector' | 'admin';
  comment: string;
  created_at: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const statusLabels = {
  pending: 'Pendente',
  assigned: 'Atribuída',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada'
};

const propertyTypeLabels = {
  apartment: 'Apartamento',
  house: 'Casa',
  commercial: 'Comercial',
  land: 'Terreno',
  other: 'Outro'
};

const userTypeLabels = {
  client: 'Cliente',
  inspector: 'Vistoriador',
  admin: 'Administrador'
};

export default function SolicitacaoDetalhesPage() {
  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [files, setFiles] = useState<InspectionFile[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();
  const params = useParams();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    loadCurrentUser();
    loadRequestDetails();
    loadFiles();
    loadComments();
  }, [requestId]);

  const loadCurrentUser = async () => {
    try {
      const user = await grifoPortalApiService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Erro ao carregar usuário atual:', err);
    }
  };

  const loadRequestDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/inspection-requests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequest(data.data);
      } else {
        setError('Erro ao carregar detalhes da solicitação');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
    }
  };

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await loadRequestDetails();
      } else {
        setError('Erro ao atualizar status');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
  };

  const handleAssignToMe = async () => {
    try {
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/assign`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          assigned_inspector_id: currentUser?.id,
          status: 'assigned'
        })
      });

      if (response.ok) {
        await loadRequestDetails();
      } else {
        setError('Erro ao atribuir solicitação');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/inspection-requests/${requestId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`
        },
        body: formData
      });

      if (response.ok) {
        await loadFiles();
        // Reset input
        event.target.value = '';
      } else {
        setError('Erro ao fazer upload do arquivo');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await fetch(`/api/v1/inspection-requests/${requestId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: newComment.trim() })
      });

      if (response.ok) {
        setNewComment('');
        await loadComments();
      } else {
        setError('Erro ao adicionar comentário');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Solicitação não encontrada</h1>
          <Link href="/solicitacoes" className="text-blue-600 hover:text-blue-700">
            Voltar para solicitações
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/solicitacoes" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
              ← Voltar para solicitações
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Detalhes da Solicitação</h1>
            <p className="text-gray-600">ID: {request.id}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              statusColors[request.status]
            }`}>
              {statusLabels[request.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Mensagem de Erro */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações da Solicitação */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detalhes do Cliente e Imóvel */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Informações da Solicitação</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Cliente</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {request.client_name}
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {request.client_email}
                  </div>
                  {request.client_phone && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {request.client_phone}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Imóvel</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start">
                    <svg className="w-4 h-4 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{request.property_address}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4m8-4v4" />
                    </svg>
                    {propertyTypeLabels[request.property_type as keyof typeof propertyTypeLabels] || request.property_type}
                  </div>
                  {request.preferred_date && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Data preferencial: {new Date(request.preferred_date).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {request.description && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Descrição</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {request.description}
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Criada em: {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR')}</span>
                <span>Atualizada em: {new Date(request.updated_at).toLocaleDateString('pt-BR')} às {new Date(request.updated_at).toLocaleTimeString('pt-BR')}</span>
              </div>
              {request.assigned_inspector_name && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Vistoriador atribuído:</strong> {request.assigned_inspector_name}
                </div>
              )}
            </div>
          </div>

          {/* Arquivos da Vistoria */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Arquivos da Vistoria</h2>
              {(request.assigned_inspector_id === currentUser?.id || currentUser?.role === 'admin') && (
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                      uploadingFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                    }`}
                  >
                    {uploadingFile ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Enviar arquivo
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
            
            {files.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Nenhum arquivo enviado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.file_size)} • Enviado em {new Date(file.uploaded_at).toLocaleDateString('pt-BR')}
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ações */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Ações</h2>
            
            <div className="space-y-3">
              {request.status === 'pending' && !request.assigned_inspector_id && (
                <button
                  onClick={handleAssignToMe}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Atribuir para mim
                </button>
              )}
              
              {request.assigned_inspector_id === currentUser?.id && request.status === 'assigned' && (
                <button
                  onClick={() => handleUpdateStatus('in_progress')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  Iniciar vistoria
                </button>
              )}
              
              {request.assigned_inspector_id === currentUser?.id && request.status === 'in_progress' && (
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Marcar como concluída
                </button>
              )}
              
              {(request.assigned_inspector_id === currentUser?.id || currentUser?.role === 'admin') && request.status !== 'cancelled' && request.status !== 'completed' && (
                <button
                  onClick={() => handleUpdateStatus('cancelled')}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Cancelar solicitação
                </button>
              )}
            </div>
          </div>

          {/* Comentários */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Comentários</h2>
            
            {/* Lista de Comentários */}
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum comentário ainda.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-blue-200 pl-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{comment.user_name}</span>
                      <span className="text-xs text-gray-500">
                        {userTypeLabels[comment.user_type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{comment.comment}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleDateString('pt-BR')} às {new Date(comment.created_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                ))
              )}
            </div>
            
            {/* Formulário de Novo Comentário */}
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Adicionar um comentário..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={submittingComment}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {submittingComment ? 'Enviando...' : 'Adicionar comentário'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}