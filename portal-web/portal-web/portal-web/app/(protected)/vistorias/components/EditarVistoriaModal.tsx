'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, FileText, Clock } from 'lucide-react';
import { grifoPortalApiService } from '@/lib/api';
import { toast } from 'sonner';

interface VisItem {
  id: string;
  imovel: string;
  endereco: string;
  corretor: string;
  data: string;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'contestada';
}

interface EditarVistoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  vistoria: VisItem | null;
  onSuccess: () => void;
}

interface FormData {
  property_id: string;
  inspection_type: 'entrada' | 'saida' | 'manutencao' | 'seguro';
  inspector_id: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'contestada';
}

interface Property {
  id: string;
  title: string;
  address: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const statusOptions = [
  { value: 'agendada', label: 'Agendada', color: 'text-blue-600' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'text-yellow-600' },
  { value: 'concluida', label: 'Concluída', color: 'text-green-600' },
  { value: 'contestada', label: 'Contestada', color: 'text-red-600' }
];

const validTransitions: Record<string, string[]> = {
  agendada: ['em_andamento', 'contestada'],
  em_andamento: ['concluida', 'contestada'],
  concluida: [], // Não pode alterar de concluída
  contestada: ['agendada'] // Pode reagendar vistorias contestadas
};

export default function EditarVistoriaModal({ isOpen, onClose, vistoria, onSuccess }: EditarVistoriaModalProps) {
  const [formData, setFormData] = useState<FormData>({
    property_id: '',
    inspection_type: 'entrada',
    inspector_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
    status: 'agendada'
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (vistoria) {
        populateFormData();
      }
    }
  }, [isOpen, vistoria]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      // Carregar propriedades e usuários
      const [propertiesResponse, usersResponse] = await Promise.all([
        grifoPortalApiService.getProperties(),
        grifoPortalApiService.getUsers()
      ]);

      if (propertiesResponse.success && propertiesResponse.data) {
        setProperties(propertiesResponse.data.map(p => ({
          id: p.id || '',
          title: p.title || 'Propriedade sem título',
          address: p.address || 'Endereço não informado'
        })));
      }

      if (usersResponse.success && usersResponse.data) {
        setUsers(usersResponse.data.map(u => ({
          id: u.id || '',
          name: u.name || 'Nome não informado',
          email: u.email || ''
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados iniciais');
    } finally {
      setLoadingData(false);
    }
  };

  const populateFormData = () => {
    if (!vistoria) return;

    const date = new Date(vistoria.data);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().slice(0, 5);

    setFormData({
      property_id: vistoria.id, // Assumindo que o ID da vistoria corresponde à propriedade
      inspection_type: 'entrada', // Valor padrão, pois não temos essa informação
      inspector_id: vistoria.id, // Valor padrão
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      notes: '',
      status: vistoria.status
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vistoria) return;

    // Validações
    if (!formData.scheduled_date || !formData.scheduled_time) {
      toast.error('Data e horário são obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00.000Z`);
      
      const updateData = {
        scheduled_date: scheduledDateTime.toISOString(),
        notes: formData.notes,
        status: formData.status,
        inspector_id: formData.inspector_id || undefined,
        inspection_type: formData.inspection_type
      };

      const response = await grifoPortalApiService.updateInspection(vistoria.id, updateData);
      
      if (response.success) {
        toast.success('Vistoria atualizada com sucesso!');
        onSuccess();
        onClose();
      } else {
        toast.error(response.error || 'Erro ao atualizar vistoria');
      }
    } catch (error) {
      console.error('Erro ao atualizar vistoria:', error);
      toast.error('Erro ao atualizar vistoria');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = () => {
    if (!vistoria) return statusOptions;
    
    const currentStatus = vistoria.status;
    const availableTransitions = validTransitions[currentStatus] || [];
    
    return statusOptions.filter(option => 
      option.value === currentStatus || availableTransitions.includes(option.value)
    );
  };

  if (!isOpen || !vistoria) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Editar Vistoria</h2>
            <p className="text-sm text-gray-500 mt-1">{vistoria.imovel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Carregando dados...</span>
            </div>
          ) : (
            <>
              {/* Informações do Imóvel */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="font-medium text-gray-900">{vistoria.imovel}</span>
                </div>
                <p className="text-sm text-gray-600">{vistoria.endereco}</p>
                <div className="flex items-center mt-2">
                  <User className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Corretor: {vistoria.corretor}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  {getAvailableStatuses().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Status atual: <span className={statusOptions.find(s => s.value === vistoria.status)?.color}>
                    {statusOptions.find(s => s.value === vistoria.status)?.label}
                  </span>
                </p>
              </div>

              {/* Tipo de Vistoria */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo de Vistoria *
                </label>
                <select
                  value={formData.inspection_type}
                  onChange={(e) => setFormData({ ...formData, inspection_type: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="seguro">Seguro</option>
                </select>
              </div>

              {/* Vistoriador */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Vistoriador
                </label>
                <select
                  value={formData.inspector_id}
                  onChange={(e) => setFormData({ ...formData, inspector_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">Selecione um vistoriador</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Data *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Horário *
                  </label>
                  <input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    required
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background resize-none"
                  rows={3}
                  placeholder="Adicione observações sobre a vistoria..."
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
