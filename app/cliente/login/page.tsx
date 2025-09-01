"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clientApiService } from '@/lib/client-api';

// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenant, setTenant] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Detectar tenant da URL
    const tenantFromUrl = searchParams.get('tenant');
    if (tenantFromUrl) {
      setTenant(tenantFromUrl);
      // Configurar tenant no serviço de API
      clientApiService.setTenant(tenantFromUrl);
    } else {
      // Verificar se há tenant salvo no localStorage
      const savedTenant = clientApiService.getTenant();
      if (savedTenant) {
        setTenant(savedTenant);
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Usar tenant detectado ou salvo
      const result = await clientApiService.login(email, password, tenant || undefined);
      
      if (result.success) {
        // Login bem-sucedido, redirecionar para dashboard do cliente
        router.replace('/cliente/dashboard');
      } else {
        setError(result.error || 'Erro ao fazer login');
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Área do Cliente</h1>
            <p className="text-gray-600">Faça login para acessar suas solicitações de vistoria</p>
            {tenant && (
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Tenant: {tenant}
              </div>
            )}
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sua senha"
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link 
                href={tenant ? `/cliente/registro?tenant=${tenant}` : '/cliente/registro'} 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Cadastre-se aqui
              </Link>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
              ← Voltar para área administrativa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}