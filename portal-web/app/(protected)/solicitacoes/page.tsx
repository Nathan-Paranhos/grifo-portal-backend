"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import grifoPortalApiService from '@/lib/api';

// Força renderização dinâmica para esta página
export const dynamic = 'force-dynamic'

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

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadCurrentUser();
    loadRequests();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await grifoPortalApiService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Erro ao carregar usuário atual:', err);
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      // Fazer requisição para a API de solicitações de vistoria
      const response = await fetch('/api/v1/inspection-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('grifo_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      } else {
        setError('Erro ao carregar solicitações');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async (requestId: string) => {
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
        await loadRequests();
      } else {
        setError('Erro ao atribuir solicitação');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
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
        await loadRequests();
      } else {
        setError('Erro ao atualizar status');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.client_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesAssigned = assignedFilter === 'all' || 
                           (assignedFilter === 'mine' && request.assigned_inspector_id === currentUser?.id) ||
                           (assignedFilter === 'unassigned' && !request.assigned_inspector_id);
    return matchesSearch && matchesStatus && matchesAssigned;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitações de Vistoria</h1>
        <p className="text-gray-600">Gerencie e execute as solicitações de vistoria dos clientes</p>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por cliente, endereço ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos os status</option>
                <option value="pending">Pendentes</option>
                <option value="assigned">Atribuídas</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Concluídas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
            <div className="sm:w-48">
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todas as atribuições</option>
                <option value="mine">Minhas solicitações</option>
                <option value="unassigned">Não atribuídas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-semibold text-gray-900">{requests.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pendentes</p>
              <p className="text-xl font-semibold text-gray-900">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Atribuídas</p>
              <p className="text-xl font-semibold text-gray-900">
                {requests.filter(r => r.status === 'assigned').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Em Andamento</p>
              <p className="text-xl font-semibold text-gray-900">
                {requests.filter(r => r.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Concluídas</p>
              <p className="text-xl font-semibold text-gray-900">
                {requests.filter(r => r.status === 'completed').length}
              </p>
            </div>
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

      {/* Lista de Solicitações */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Solicitações ({filteredRequests.length})</h2>
        </div>
        
        {filteredRequests.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 mb-4">Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRequests.map((request) => (
              <div key={request.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-sm font-medium text-gray-900">{request.client_name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[request.status]
                      }`}>
                        {statusLabels[request.status]}
                      </span>
                      {request.assigned_inspector_name && (
                        <span className="text-xs text-gray-500">
                          Atribuída para: {request.assigned_inspector_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {request.property_address}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4m8-4v4" />
                          </svg>
                          {propertyTypeLabels[request.property_type as keyof typeof propertyTypeLabels] || request.property_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span>{request.client_email}</span>
                        {request.client_phone && (
                          <>
                            <span>•</span>
                            <span>{request.client_phone}</span>
                          </>
                        )}
                        {request.preferred_date && (
                          <>
                            <span>•</span>
                            <span>Data preferencial: {new Date(request.preferred_date).toLocaleDateString('pt-BR')}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        Criada em: {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR')}
                      </div>
                      
                      {request.description && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <strong>Descrição:</strong> {request.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <Link
                      href={`/solicitacoes/${request.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Ver detalhes
                    </Link>
                    
                    {request.status === 'pending' && !request.assigned_inspector_id && (
                      <button
                        onClick={() => handleAssignToMe(request.id)}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Atribuir para mim
                      </button>
                    )}
                    
                    {request.assigned_inspector_id === currentUser?.id && request.status === 'assigned' && (
                      <button
                        onClick={() => handleUpdateStatus(request.id, 'in_progress')}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        Iniciar vistoria
                      </button>
                    )}
                    
                    {request.assigned_inspector_id === currentUser?.id && request.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(request.id, 'completed')}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Marcar como concluída
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
