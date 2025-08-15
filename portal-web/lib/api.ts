// Serviço de API para o Portal Web Grifo

// Configuração da API Grifo
const GRIFO_API_BASE_URL = 'https://grifo-api.onrender.com';
const GRIFO_API_DEV_URL = 'http://localhost:1000';

// Configuração do Supabase (fallback)
const SUPABASE_REST_URL = 'https://fsvwifbvehdhlufauahj.supabase.co/rest/v1';
const SUPABASE_FUNCTIONS_URL = 'https://fsvwifbvehdhlufauahj.supabase.co/functions/v1';
const SUPABASE_AUTH_URL = 'https://fsvwifbvehdhlufauahj.supabase.co/auth/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI';

// Determina se está em desenvolvimento
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE_URL = isDevelopment ? GRIFO_API_DEV_URL : GRIFO_API_BASE_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface User {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  company_id?: string;
  role?: string;
  created_at?: string;
}

interface Empresa {
  id?: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string;
}

interface Property {
  id?: string;
  address: string;
  type: string;
  cep: string;
  city: string;
  state: string;
  company_id: string;
  reference: string;
  created_at?: string;
  updated_at?: string;
}

interface Inspection {
  id?: string;
  property_id: string;
  user_id: string;
  status: string;
  data: any;
  photos?: string[];
  created_at?: string;
  updated_at?: string;
}

interface Contestation {
  id: string;
  inspection_id: string;
  user_id: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

class GrifoPortalApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private useGrifoApi: boolean = true;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.loadAuthToken();
  }

  private loadAuthToken(): void {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('grifo_auth_token');
    }
  }

  private saveAuthToken(token: string): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('grifo_auth_token', token);
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('grifo_auth_token');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit & { baseUrl?: string; useGrifoFirst?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { baseUrl = this.baseUrl, useGrifoFirst = this.useGrifoApi, ...fetchOptions } = options;
    
    // Se deve tentar API Grifo primeiro
    if (useGrifoFirst && baseUrl === this.baseUrl) {
      try {
        const grifoUrl = `${this.baseUrl}${endpoint}`;
        
        const response = await fetch(grifoUrl, {
          ...fetchOptions,
          headers: {
            ...this.getHeaders(),
            ...fetchOptions.headers,
          },
        });

        const data = await response.json();

        // Se token expirou, tenta refresh
        if (response.status === 401 && this.authToken) {
          const refreshResult = await this.refreshToken();
          if (refreshResult.success) {
            // Retry com novo token
            const retryResponse = await fetch(grifoUrl, {
              ...fetchOptions,
              headers: {
                ...this.getHeaders(),
                ...fetchOptions.headers,
              },
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              return {
                success: true,
                data: retryData,
              };
            }
          }
        }

        if (response.ok) {
          return {
            success: true,
            data,
          };
        }

        // Se API Grifo falhar, tenta Supabase como fallback
        console.warn('API Grifo request failed, trying Supabase fallback');
      } catch (error) {
        console.warn('API Grifo connection failed, trying Supabase fallback:', error);
      }
    }

    // Fallback para Supabase ou requisição direta
    try {
      const finalBaseUrl = baseUrl === this.baseUrl ? SUPABASE_REST_URL : baseUrl;
      const url = `${finalBaseUrl}${endpoint}`;
      
      const baseHeaders = this.getHeaders();
      const defaultHeaders: Record<string, string> = {};
      
      // Converter HeadersInit para Record<string, string>
      if (baseHeaders instanceof Headers) {
        baseHeaders.forEach((value, key) => {
          defaultHeaders[key] = value;
        });
      } else if (Array.isArray(baseHeaders)) {
        baseHeaders.forEach(([key, value]) => {
          defaultHeaders[key] = value;
        });
      } else if (baseHeaders) {
        Object.assign(defaultHeaders, baseHeaders);
      }
      
      // Para endpoints do Supabase, sempre adicionar apikey
      if (finalBaseUrl.includes('supabase.co')) {
        defaultHeaders['apikey'] = SUPABASE_ANON_KEY;
      }
      
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...defaultHeaders,
          ...fetchOptions.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Erro na requisição',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Erro na requisição:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Autenticação
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    // Primeiro tenta a API Grifo
    if (this.useGrifoApi) {
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email.trim().toLowerCase(), 
            password 
          }),
        });

        const data = await response.json();

        if (response.ok && data.token) {
          this.saveAuthToken(data.token);
          return {
            success: true,
            data: {
              user: data.user,
              token: data.token
            }
          };
        }

        // Se a API Grifo falhar, tenta Supabase como fallback
        console.warn('API Grifo login failed, trying Supabase fallback');
      } catch (error) {
        console.warn('API Grifo connection failed, trying Supabase fallback:', error);
      }
    }

    // Fallback para Supabase Auth
    try {
      const response = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error_description || data.msg || 'Credenciais inválidas'
        };
      }

      if (data.access_token) {
        this.saveAuthToken(data.access_token);
        return {
          success: true,
          data: {
            user: data.user,
            token: data.access_token
          }
        };
      }

      return {
        success: false,
        error: 'Token de acesso não recebido'
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet.'
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    this.clearAuthToken();
    return { success: true };
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    if (!this.authToken) {
      return { success: false, error: 'Não autenticado' };
    }

    return this.makeRequest<{ token: string }>('/api/auth/refresh', {
      method: 'POST'
    });
  }

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  // Dashboard KPIs
  async getDashboard(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/api/dashboard/kpis');
  }

  // Empresas
  async getEmpresas(): Promise<ApiResponse<Empresa[]>> {
    return this.makeRequest<Empresa[]>('/api/empresas');
  }

  async createEmpresa(empresa: Partial<Empresa>): Promise<ApiResponse<Empresa>> {
    return this.makeRequest<Empresa>('/api/empresas', {
      method: 'POST',
      body: JSON.stringify(empresa)
    });
  }

  async updateEmpresa(id: string, updates: Partial<Empresa>): Promise<ApiResponse<Empresa>> {
    return this.makeRequest<Empresa>(`/api/empresas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteEmpresa(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/empresas/${id}`, {
      method: 'DELETE'
    });
  }

  // Usuários
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.makeRequest<User[]>('/api/users/profile');
  }

  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/users/${id}`, {
      method: 'DELETE'
    });
  }

  // Propriedades/Imóveis
  async getProperties(): Promise<ApiResponse<Property[]>> {
    return this.makeRequest<Property[]>('/rest/v1/imoveis', { baseUrl: SUPABASE_REST_URL });
  }

  async createProperty(property: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>('/rest/v1/imoveis', {
      method: 'POST',
      body: JSON.stringify(property),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>(`/rest/v1/imoveis?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async deleteProperty(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/rest/v1/imoveis?id=eq.${id}`, {
      method: 'DELETE',
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Vistorias/Inspeções
  async getInspections(): Promise<ApiResponse<Inspection[]>> {
    return this.makeRequest<Inspection[]>('/rest/v1/vistorias', { baseUrl: SUPABASE_REST_URL });
  }

  async createInspection(inspection: Partial<Inspection>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>('/rest/v1/vistorias', {
      method: 'POST',
      body: JSON.stringify(inspection),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`/rest/v1/vistorias?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async deleteInspection(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/rest/v1/vistorias?id=eq.${id}`, {
      method: 'DELETE',
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Contestações
  async getContestations(): Promise<ApiResponse<Contestation[]>> {
    return this.makeRequest<Contestation[]>('/rest/v1/contestacoes', { baseUrl: SUPABASE_REST_URL });
  }

  async createContestation(contestation: Partial<Contestation>): Promise<ApiResponse<Contestation>> {
    return this.makeRequest<Contestation>('/rest/v1/contestacoes', {
      method: 'POST',
      body: JSON.stringify(contestation),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async updateContestation(id: string, updates: Partial<Contestation>): Promise<ApiResponse<Contestation>> {
    return this.makeRequest<Contestation>(`/rest/v1/contestacoes?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Relatórios e estatísticas
  async getUsageStats(filters?: any): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/rest/v1/rpc/usage_stats', {
      method: 'POST',
      body: JSON.stringify({ filters }),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async exportData(type: string, filters?: any): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>('/rest/v1/rpc/export_data', {
      method: 'POST',
      body: JSON.stringify({ export_format: type, filters }),
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Verificar conectividade
  async checkHealth(): Promise<ApiResponse<{ status: string; version: string }>> {
    try {
      const response = await this.makeRequest<any[]>('/rest/v1/empresas?limit=1', { baseUrl: SUPABASE_REST_URL });
      return {
        success: true,
        data: {
          status: response.success ? 'healthy' : 'unhealthy',
          version: '1.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Serviço indisponível'
      };
    }
  }
}

// Instância singleton
const grifoPortalApiService = new GrifoPortalApiService();

export default grifoPortalApiService;
export type {
  ApiResponse,
  User,
  Empresa,
  Property,
  Inspection,
  Contestation,
};