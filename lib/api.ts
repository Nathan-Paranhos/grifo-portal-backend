// Serviço de API para o Portal Web Grifo - Multi-tenant Architecture

// Configuração da API Grifo
const GRIFO_API_BASE_URL = 'https://grifo-api-backend.onrender.com';
const GRIFO_API_DEV_URL = 'http://localhost:5000'; // API local para desenvolvimento

// Usar URL local durante desenvolvimento
const API_BASE_URL = process.env.NODE_ENV === 'production' ? GRIFO_API_BASE_URL : GRIFO_API_DEV_URL;

// Tenant padrão para o portal (pode ser configurado dinamicamente)
const DEFAULT_TENANT = 'grifo';

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
  avatar_url?: string;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

interface UserSession {
  id: string;
  device: string;
  location: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
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



class GrifoPortalApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private tenant: string;
  private companyId: string | null = null;

  constructor(tenant: string = DEFAULT_TENANT) {
    this.baseUrl = API_BASE_URL;
    this.tenant = tenant;
    this.loadAuthToken();
    this.loadCompanyId();
  }

  private loadAuthToken(): void {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('grifo_token');
    }
  }

  private saveAuthToken(token: string): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('grifo_token', token);
      // Também salvar no cookie para o middleware
      document.cookie = `grifo_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('grifo_token');
      localStorage.removeItem('grifo_company_id');
      // Também limpar o cookie
      document.cookie = 'grifo_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  private loadCompanyId(): void {
    if (typeof window !== 'undefined') {
      this.companyId = localStorage.getItem('grifo_company_id');
    }
  }

  private saveCompanyId(companyId: string): void {
    this.companyId = companyId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('grifo_company_id', companyId);
    }
  }

  private getTenantPath(): string {
    return `/api/v1/tenants/${this.tenant}`;
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
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      // Se token expirou, tenta refresh
      if (response.status === 401 && this.authToken) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.success) {
          // Retry com novo token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...this.getHeaders(),
              ...options.headers,
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
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('API Request Error:', {
          url: `${this.baseUrl}${endpoint}`,
          method: options?.method || 'GET',
          error: error instanceof Error ? error.message : error
        });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Autenticação
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/portal/login`, {
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

      if (response.ok && data.success && data.data) {
        // Store tokens and company info from API response
        this.saveAuthToken(data.data.access_token);
        if (data.data.user?.company_id) {
          this.saveCompanyId(data.data.user.company_id);
        }
        
        return {
          success: true,
          data: {
            user: data.data.user,
            token: data.data.access_token
          }
        };
      } else {
        return {
          success: false,
          error: data.message || 'Credenciais inválidas'
        };
      }
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Login Error:', error instanceof Error ? error.message : error);
      }
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
    if (!this.authToken) {
      return false;
    }
    
    // Verificar se o token não está expirado
    try {
      const tokenPayload = JSON.parse(atob(this.authToken.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenPayload.exp && tokenPayload.exp < currentTime) {
        this.clearAuthToken();
        return false;
      }
      
      return true;
    } catch (error) {
      // Se não conseguir decodificar o token, considera inválido
      this.clearAuthToken();
      return false;
    }
  }

  // Verificar autenticação com a API (método assíncrono)
  async verifyAuthentication(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    try {
      const response = await this.getCurrentUser();
      if (response.success) {
        return true;
      } else {
        this.clearAuthToken();
        return false;
      }
    } catch (error) {
      this.clearAuthToken();
      return false;
    }
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
    return this.makeRequest<User[]>(`${this.getTenantPath()}/users`);
  }

  // Perfil do usuário logado
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/v1/auth/me');
  }

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async uploadAvatar(file: File): Promise<ApiResponse<{ avatarUrl: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    return this.makeRequest<{ avatarUrl: string }>('/api/users/avatar', {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type para permitir multipart/form-data
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
      }
    });
  }

  async getActiveSessions(): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/api/users/sessions');
  }

  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/users/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>(`${this.getTenantPath()}/users`, {
      method: 'POST',
      body: JSON.stringify(user)
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>(`${this.getTenantPath()}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`${this.getTenantPath()}/users/${id}`, {
      method: 'DELETE'
    });
  }

  // Propriedades/Imóveis
  async getProperties(): Promise<ApiResponse<Property[]>> {
    return this.makeRequest<Property[]>(`${this.getTenantPath()}/properties`);
  }

  async createProperty(property: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>(`${this.getTenantPath()}/properties`, {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>(`${this.getTenantPath()}/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteProperty(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`${this.getTenantPath()}/properties/${id}`, {
      method: 'DELETE'
    });
  }

  // Vistorias/Inspeções
  async getInspections(): Promise<ApiResponse<Inspection[]>> {
    return this.makeRequest<Inspection[]>(`${this.getTenantPath()}/inspections`);
  }

  async createInspection(inspection: Partial<Inspection>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`${this.getTenantPath()}/inspections`, {
      method: 'POST',
      body: JSON.stringify(inspection)
    });
  }

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`${this.getTenantPath()}/inspections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteInspection(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`${this.getTenantPath()}/inspections/${id}`, {
      method: 'DELETE'
    });
  }

  async getInspection(id: string): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`${this.getTenantPath()}/inspections/${id}`);
  }



  // Relatórios e estatísticas
  async getUsageStats(filters?: any): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>(`${this.getTenantPath()}/reports/usage-stats`, {
      method: 'POST',
      body: JSON.stringify({ filters })
    });
  }

  async exportData(type: string, filters?: any): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>(`${this.getTenantPath()}/reports/export`, {
      method: 'POST',
      body: JSON.stringify({ export_format: type, filters })
    });
  }

  // Verificar conectividade
  async checkHealth(): Promise<ApiResponse<{ status: string; version: string }>> {
    try {
      const response = await this.makeRequest<{ status: string; version: string }>('/api/v1/health');
      if (response.success) {
        return response;
      } else {
        return {
          success: false,
          error: 'Serviço indisponível'
        };
      }
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
  UserSession,
  Empresa,
  Property,
  Inspection,
};