"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientApiService } from '@/lib/client-api';

interface FormData {
  property_address: string;
  property_type: string;
  requested_date: string;
  description: string;
}

const propertyTypes = [
  { value: 'residential', label: 'Residencial' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'rural', label: 'Rural' },
  { value: 'other', label: 'Outro' }
];

export default function NovasolicitacaoPage() {
  const [formData, setFormData] = useState<FormData>({
    property_address: '',
    property_type: '',
    requested_date: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Verificar autenticação
      if (!clientApiService.isAuthenticated()) {
        router.push('/cliente/login');
        return;
      }

      // Validações básicas
      if (!formData.property_address.trim()) {
        setError('Endereço do imóvel é obrigatório');
        return;
      }

      if (!formData.property_type) {
        setError('Tipo do imóvel é obrigatório');
        return;
      }

      // Criar solicitação
      const response = await clientApiService.createInspectionRequest({
        property_address: formData.property_address.trim(),
        property_type: formData.property_type,
        requested_date: formData.requested_date || undefined,
        description: formData.description.trim() || undefined
      });

      if (response.success) {
        setSuccess('Solicitação criada com sucesso!');
        setTimeout(() => {
          router.push('/cliente/dashboard');
        }, 2000);
      } else {
        setError(response.error || 'Erro ao criar solicitação');
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Data mínima (hoje)
  const today = new Date().toISOString().split('T')[0];

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
              <h1 className="text-xl font-semibold text-gray-900">Nova Solicitação de Vistoria</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Endereço do Imóvel */}
            <div>
              <label htmlFor="property_address" className="block text-sm font-medium text-gray-700 mb-2">
                Endereço do Imóvel *
              </label>
              <input
                type="text"
                id="property_address"
                name="property_address"
                value={formData.property_address}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o endereço completo do imóvel"
                required
              />
            </div>

            {/* Tipo do Imóvel */}
            <div>
              <label htmlFor="property_type" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo do Imóvel *
              </label>
              <select
                id="property_type"
                name="property_type"
                value={formData.property_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Selecione o tipo do imóvel</option>
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Preferencial */}
            <div>
              <label htmlFor="requested_date" className="block text-sm font-medium text-gray-700 mb-2">
                Data Preferencial para Vistoria
              </label>
              <input
                type="date"
                id="requested_date"
                name="requested_date"
                value={formData.requested_date}
                onChange={handleInputChange}
                min={today}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Opcional. Se não informada, entraremos em contato para agendar.
              </p>
            </div>

            {/* Descrição */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição Adicional
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Descreva detalhes importantes sobre o imóvel ou a vistoria (opcional)"
              />
            </div>

            {/* Mensagens */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="ml-3 text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="ml-3 text-sm text-green-700">{success}</p>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Criando...
                  </div>
                ) : (
                  'Criar Solicitação'
                )}
              </button>
              <Link
                href="/cliente/dashboard"
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-center"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>

        {/* Informações Adicionais */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">Informações Importantes</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Após criar a solicitação, nossa equipe entrará em contato em até 24 horas.
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Você receberá atualizações sobre o status da vistoria por email.
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              O relatório final será disponibilizado neste portal após a conclusão.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}