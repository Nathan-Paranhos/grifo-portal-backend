'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, FileText, Clock, User, Mail, Phone } from 'lucide-react';

type Props = { params: { id: string } };

interface VistoriaData {
  id: string;
  numero_vistoria: string;
  imovel: {
    endereco: string;
    cidade: string;
    estado: string;
  };
  empresa: {
    nome: string;
  };
  data_vistoria: string;
  status: string;
}

interface ContestFormData {
  tipo: 'technical' | 'commercial' | 'other';
  prioridade: 'low' | 'medium' | 'high';
  motivo: string;
  descricao: string;
  contestant_name: string;
  contestant_email: string;
  contestant_phone: string;
}

export default function ContestarPublicPage({ params }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vistoriaData, setVistoriaData] = useState<VistoriaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<ContestFormData>({
    tipo: 'technical',
    prioridade: 'medium',
    motivo: '',
    descricao: '',
    contestant_name: '',
    contestant_email: '',
    contestant_phone: ''
  });

  const token = params.id;

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000'
      const response = await fetch(`${apiUrl}/api/public/contest/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Token inválido');
      }

      setVistoriaData(data.vistoria);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar token');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000'
      const response = await fetch(`${apiUrl}/api/public/contest/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar contestação');
      }

      setSuccess(true);
      toast.success('Contestação enviada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar contestação';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ContestFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando link de contestação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Inválido</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Este link pode ter expirado ou já ter sido utilizado. Entre em contato com a empresa responsável pela vistoria.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contestação Enviada!</h1>
          <p className="text-gray-600 mb-4">
            Sua contestação foi enviada com sucesso e será analisada pela equipe responsável.
          </p>
          <p className="text-sm text-gray-500">
            Você receberá atualizações sobre o status da sua contestação no email fornecido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contestação de Laudo</h1>
              <p className="text-gray-600">Vistoria #{vistoriaData?.numero_vistoria}</p>
            </div>
          </div>
          
          {/* Vistoria Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Informações da Vistoria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Empresa:</span>
                <p className="text-gray-600">{vistoriaData?.empresa.nome}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Data da Vistoria:</span>
                <p className="text-gray-600">
                  {vistoriaData?.data_vistoria ? new Date(vistoriaData.data_vistoria).toLocaleDateString('pt-BR') : 'N/A'}
                </p>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700">Endereço:</span>
                <p className="text-gray-600">
                  {vistoriaData?.imovel.endereco}, {vistoriaData?.imovel.cidade} - {vistoriaData?.imovel.estado}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contest Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Formulário de Contestação</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contestant_name}
                  onChange={(e) => handleInputChange('contestant_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Seu nome completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.contestant_email}
                  onChange={(e) => handleInputChange('contestant_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Telefone
              </label>
              <input
                type="tel"
                value={formData.contestant_phone}
                onChange={(e) => handleInputChange('contestant_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(11) 99999-9999"
              />
            </div>

            {/* Contest Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Contestação *
                </label>
                <select
                  required
                  value={formData.tipo}
                  onChange={(e) => handleInputChange('tipo', e.target.value as ContestFormData['tipo'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="technical">Técnica</option>
                  <option value="commercial">Comercial</option>
                  <option value="other">Outros</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade
                </label>
                <select
                  value={formData.prioridade}
                  onChange={(e) => handleInputChange('prioridade', e.target.value as ContestFormData['prioridade'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da Contestação *
              </label>
              <textarea
                required
                rows={3}
                value={formData.motivo}
                onChange={(e) => handleInputChange('motivo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descreva brevemente o motivo da sua contestação..."
                minLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição Detalhada
              </label>
              <textarea
                rows={5}
                value={formData.descricao}
                onChange={(e) => handleInputChange('descricao', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Forneça mais detalhes sobre sua contestação, incluindo evidências ou informações adicionais..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  'Enviar Contestação'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Esta contestação será analisada pela equipe responsável.</p>
          <p>Você receberá atualizações sobre o status no email fornecido.</p>
        </div>
      </div>
    </div>
  );
}
