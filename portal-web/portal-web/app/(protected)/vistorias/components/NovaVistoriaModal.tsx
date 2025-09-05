"use client";
import { useState, useEffect } from "react";
import grifoPortalApiService from "../../../../lib/api";

interface Property {
  id: string;
  endereco: string;
  tipo_imovel: string;
  unidade?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface NovaVistoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaVistoriaModal({ isOpen, onClose, onSuccess }: NovaVistoriaModalProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [formData, setFormData] = useState({
    property_id: '',
    inspector_id: '',
    inspection_type: 'entrada' as 'entrada' | 'saida' | 'manutencao' | 'seguro',
    scheduled_date: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Carregar propriedades e usuários
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      // Carregar propriedades
      const propertiesResponse = await grifoPortalApiService.getProperties();
      if (propertiesResponse.success && propertiesResponse.data) {
        setProperties(propertiesResponse.data);
      }

      // Carregar usuários (vistoriadores)
      const usersResponse = await grifoPortalApiService.getUsers();
      if (usersResponse.success && usersResponse.data) {
        setUsers(usersResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.property_id) {
      newErrors.property_id = 'Selecione um imóvel';
    }
    if (!formData.inspector_id) {
      newErrors.inspector_id = 'Selecione um vistoriador';
    }
    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'Selecione uma data';
    } else {
      const selectedDate = new Date(formData.scheduled_date);
      const now = new Date();
      if (selectedDate < now) {
        newErrors.scheduled_date = 'A data deve ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await grifoPortalApiService.createInspection({
        property_id: formData.property_id,
        inspector_id: formData.inspector_id,
        inspection_type: formData.inspection_type,
        scheduled_date: formData.scheduled_date,
        notes: formData.notes,
        status: 'agendada'
      });

      if (response.success) {
        onSuccess();
        handleClose();
      } else {
        setErrors({ submit: 'Erro ao criar vistoria. Tente novamente.' });
      }
    } catch (error) {
      console.error('Erro ao criar vistoria:', error);
      setErrors({ submit: 'Erro ao criar vistoria. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      property_id: '',
      inspector_id: '',
      inspection_type: 'entrada',
      scheduled_date: '',
      notes: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Nova Vistoria</h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {loadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção de Imóvel */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Imóvel *
                </label>
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">Selecione um imóvel</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.endereco} {property.unidade ? `- ${property.unidade}` : ''}
                    </option>
                  ))}
                </select>
                {errors.property_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.property_id}</p>
                )}
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
                  Vistoriador *
                </label>
                <select
                  value={formData.inspector_id}
                  onChange={(e) => setFormData({ ...formData, inspector_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">Selecione um vistoriador</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {errors.inspector_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.inspector_id}</p>
                )}
              </div>

              {/* Data e Hora */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  min={new Date().toISOString().slice(0, 16)}
                />
                {errors.scheduled_date && (
                  <p className="text-sm text-red-500 mt-1">{errors.scheduled_date}</p>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  rows={3}
                  placeholder="Observações adicionais sobre a vistoria..."
                />
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-sm text-red-500">{errors.submit}</p>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-10 px-4 rounded-md border border-gray-200 hover:bg-muted/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Vistoria'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
