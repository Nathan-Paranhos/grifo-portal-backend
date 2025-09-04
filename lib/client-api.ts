// Serviço de API para o Sistema de Clientes

// Configuração do Supabase para produção
const SUPABASE_URL = 'https://fsvwifbvehdhlufauahj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI';

// URLs da API
const GRIFO_API_BASE_URL = 'https://grifo-api-backend.onrender.com';
const GRIFO_API_DEV_URL = 'http://localhost:5000';

// Usar Supabase diretamente para produção
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? SUPABASE_URL
  : GRIFO_API_DEV_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  status?: string;
  tenant?: string;
  created_at?: string;
  updated_at?: string;
}

interface ClientSession {
  id: string;
  client_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

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

class ClientApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private tenant: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.loadAuthToken();
    this.detectTenant();
  }

  private detectTenant(): void {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tenantFromUrl = urlParams.get('tenant');
      
      if (tenantFromUrl) {
        this.tenant = tenantFromUrl;
        // Salvar tenant no localStorage para persistir durante a sessão
        localStorage.setItem('client_tenant', tenantFromUrl);
      } else {
        // Tentar recuperar tenant do localStorage
        this.tenant = localStorage.getItem('client_tenant');
      }
    }
  }

  public getTenant(): string | null {
    return this.tenant;
  }

  public setTenant(tenant: string): void {
    this.tenant = tenant;
    if (typeof window !== 'undefined') {
      localStorage.setItem('client_tenant', tenant);
    }
  }

  private loadAuthToken(): void {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('client_token');
    }
  }

  private saveAuthToken(token: string): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('client_token', token);
      // Também salvar no cookie para o middleware
      document.cookie = `client_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('client_token');
      localStorage.removeItem('client_tenant');
      // Também limpar o cookie
      document.cookie = 'client_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
        console.error('Client API Request Error:', {
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

  // Autenticação de Clientes com Tenant
  async register(clientData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    tenant?: string;
  }): Promise<ApiResponse<{ client: Client }>> {
    const tenant = clientData.tenant || this.tenant;
    if (!tenant) {
      return {
        success: false,
        error: 'Tenant é obrigatório para registro'
      };
    }

    return this.makeRequest<{ client: Client }>('/api/v1/auth/client/register', {
      method: 'POST',
      body: JSON.stringify({ ...clientData, tenant })
    });
  }

  async login(email: string, password: string, tenant?: string): Promise<ApiResponse<{ client: Client; token: string }>> {
    try {
      const loginTenant = tenant || this.tenant;
      if (!loginTenant) {
        return {
          success: false,
          error: 'Tenant é obrigatório para login'
        };
      }

      const response = await this.makeRequest<{ client: Client; token: string }>('/api/v1/auth/client/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password,
          tenant: loginTenant
        })
      });

      if (response.success && response.data) {
        // Salvar token de autenticação e tenant
        this.saveAuthToken(response.data.token);
        this.setTenant(loginTenant);
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet.'
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      await this.makeRequest<void>('/api/v1/auth/client/logout', {
        method: 'POST'
      });
    } catch (error) {
      // Mesmo se der erro na API, limpar token local
    } finally {
      this.clearAuthToken();
    }
    return { success: true };
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

  // Perfil do Cliente
  async getProfile(): Promise<ApiResponse<Client>> {
    return this.makeRequest<Client>('/api/v1/clients/profile');
  }

  async updateProfile(updates: Partial<Client>): Promise<ApiResponse<Client>> {
    return this.makeRequest<Client>('/api/v1/clients/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Solicitações de Vistoria
  async getInspectionRequests(): Promise<ApiResponse<InspectionRequest[]>> {
    return this.makeRequest<InspectionRequest[]>('/api/v1/inspection-requests');
  }

  async getInspectionRequest(id: string): Promise<ApiResponse<InspectionRequest>> {
    return this.makeRequest<InspectionRequest>(`/api/v1/inspection-requests/${id}`);
  }

  async createInspectionRequest(requestData: {
    property_address: string;
    property_type: string;
    requested_date?: string;
    description?: string;
  }): Promise<ApiResponse<InspectionRequest>> {
    return this.makeRequest<InspectionRequest>('/api/v1/inspection-requests', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  async addInspectionComment(requestId: string, comment: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(`/api/v1/inspection-requests/${requestId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  }

  async getInspectionComments(requestId: string): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>(`/api/v1/inspection-requests/${requestId}/comments`);
  }

  // Arquivos de Vistoria
  async getInspectionFiles(requestId: string): Promise<ApiResponse<InspectionFile[]>> {
    return this.makeRequest<InspectionFile[]>(`/api/v1/inspection-requests/${requestId}/files`);
  }

  async downloadFile(fileId: string): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/inspection-requests/files/${fileId}/download`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'Erro ao baixar arquivo'
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro de conexão ao baixar arquivo'
      };
    }
  }

  // Método para gerar URL de login com tenant
  getLoginUrl(tenant: string): string {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      return `${baseUrl}/cliente/login?tenant=${tenant}`;
    }
    return `/cliente/login?tenant=${tenant}`;
  }
}

// Instância singleton do serviço
export const clientApiService = new ClientApiService();
export default clientApiService;