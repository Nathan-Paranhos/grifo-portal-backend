import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração da API Grifo
const GRIFO_API_BASE_URL = process.env.EXPO_PUBLIC_GRIFO_API_URL || 'https://grifo-api.onrender.com';
const GRIFO_API_DEV_URL = 'http://localhost:1000';

// Configuração do Supabase (fallback)
const SUPABASE_REST_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1` || 'https://fsvwifbvehdhlufauahj.supabase.co/rest/v1';
const SUPABASE_FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1` || 'https://fsvwifbvehdhlufauahj.supabase.co/functions/v1';
const SUPABASE_AUTH_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1` || 'https://fsvwifbvehdhlufauahj.supabase.co/auth/v1';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI';

// Determina se está em desenvolvimento
const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
const API_BASE_URL = isDevelopment ? GRIFO_API_DEV_URL : GRIFO_API_BASE_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface SyncData {
  inspections?: any[];
  properties?: any[];
  notifications?: any[];
  lastSync?: string;
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

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
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

class GrifoApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private useGrifoApi: boolean = true; // Habilitado para usar API Grifo local

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.loadAuthToken();
  }

  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('grifo_auth_token');
    } catch (error) {
      console.error('Erro ao carregar token de autenticação:', error);
    }
  }

  private async saveAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      await AsyncStorage.setItem('grifo_auth_token', token);
    } catch (error) {
      console.error('Erro ao salvar token de autenticação:', error);
    }
  }

  private async clearAuthToken(): Promise<void> {
    try {
      this.authToken = null;
      await AsyncStorage.removeItem('grifo_auth_token');
    } catch (error) {
      console.error('Erro ao limpar token de autenticação:', error);
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
        // API Grifo request failed, trying Supabase fallback
      } catch (error) {
        // API Grifo connection failed, trying Supabase fallback
      }
    }

    // Fallback para Supabase ou requisição direta
    try {
      const finalBaseUrl = baseUrl === this.baseUrl ? SUPABASE_REST_URL : baseUrl;
      const url = `${finalBaseUrl}${endpoint}`;
      
      const defaultHeaders = {
        ...this.getHeaders(),
      };
      
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
      // Request error handled silently
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Autenticação usando API Grifo com fallback para Supabase
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
          await this.saveAuthToken(data.token);
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
        await this.saveAuthToken(data.access_token);
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

  async register(userData: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }): Promise<ApiResponse<{ user: User; token: string }>> {
    // Primeiro tenta a API Grifo
    if (this.useGrifoApi) {
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email.trim().toLowerCase(),
            password: userData.password,
            name: userData.name.trim(),
            phone: userData.phone?.trim() || null
          }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.token) {
            await this.saveAuthToken(data.token);
          }
          return {
            success: true,
            data: {
              user: data.user,
              token: data.token || ''
            }
          };
        }

        // Se a API Grifo falhar, tenta Supabase como fallback
        console.warn('API Grifo register failed, trying Supabase fallback');
      } catch (error) {
        console.warn('API Grifo connection failed, trying Supabase fallback:', error);
      }
    }

    // Fallback para Supabase Auth
    try {
      const response = await fetch(`${SUPABASE_AUTH_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: userData.email.trim().toLowerCase(),
          password: userData.password,
          data: {
            name: userData.name.trim(),
            phone: userData.phone?.trim() || null
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error_description || data.msg || 'Erro ao criar conta'
        };
      }

      // Para registro, pode não retornar access_token imediatamente (confirmação de email)
      if (data.access_token) {
        await this.saveAuthToken(data.access_token);
        return {
          success: true,
          data: {
            user: data.user,
            token: data.access_token
          }
        };
      }

      // Registro bem-sucedido mas sem login automático
      return {
        success: true,
        data: {
          user: data.user,
          token: ''
        }
      };
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet.'
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    // Primeiro tenta logout na API Grifo
    if (this.useGrifoApi && this.authToken) {
      try {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.warn('API Grifo logout failed:', error);
      }
    }

    // Também tenta logout no Supabase (fallback)
    try {
      if (this.authToken) {
        await fetch(`${SUPABASE_AUTH_URL}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'apikey': SUPABASE_ANON_KEY,
          },
        });
      }
    } catch (error) {
      console.warn('Supabase logout request failed:', error);
    } finally {
      await this.clearAuthToken();
    }

    return { success: true };
  }

  // Refresh token usando API Grifo
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    if (!this.authToken) {
      return {
        success: false,
        error: 'Nenhum token para renovar'
      };
    }

    // Primeiro tenta a API Grifo
    if (this.useGrifoApi) {
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data.token) {
          await this.saveAuthToken(data.token);
          return {
            success: true,
            data: {
              token: data.token
            }
          };
        }
      } catch (error) {
        console.warn('API Grifo refresh token failed:', error);
      }
    }

    // Para Supabase, o token refresh é automático
    return {
      success: false,
      error: 'Não foi possível renovar o token'
    };
  }

  // Sincronização usando endpoints reais
  async getSyncData(): Promise<ApiResponse<SyncData>> {
    try {
      // Buscar dados de múltiplas tabelas
      const [vistorias, imoveis] = await Promise.all([
        this.makeRequest<any[]>('/rest/v1/vistorias', { baseUrl: SUPABASE_REST_URL }),
        this.makeRequest<any[]>('/rest/v1/imoveis', { baseUrl: SUPABASE_REST_URL })
      ]);
      
      return {
        success: true,
        data: {
          inspections: vistorias.data || [],
          properties: imoveis.data || [],
          lastSync: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na sincronização'
      };
    }
  }

  async sendSyncData(data: SyncData): Promise<ApiResponse<any>> {
    // Usar função edge para sincronização
    return this.makeRequest('/functions/v1/drive_sync', {
      method: 'POST',
      body: JSON.stringify(data),
      baseUrl: SUPABASE_FUNCTIONS_URL
    });
  }

  // Vistorias (Inspections) usando API Grifo com fallback
  async getInspections(): Promise<ApiResponse<Inspection[]>> {
    return this.makeRequest<Inspection[]>('/api/vistorias');
  }

  async createInspection(inspection: Omit<Inspection, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>('/api/vistorias', {
      method: 'POST',
      body: JSON.stringify(inspection)
    });
  }

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`/api/vistorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async finalizeInspection(id: string): Promise<ApiResponse<Inspection>> {
    return this.makeRequest<Inspection>(`/api/vistorias/${id}/finalize`, {
      method: 'POST'
    });
  }

  // Imóveis (Properties) usando API Grifo com fallback
  async getProperties(): Promise<ApiResponse<Property[]>> {
    return this.makeRequest<Property[]>('/api/imoveis');
  }

  async createProperty(property: Omit<Property, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>('/api/imoveis', {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>(`/api/imoveis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async getProperty(id: string): Promise<ApiResponse<Property>> {
    return this.makeRequest<Property>(`/api/imoveis/${id}`);
  }

  // Notificações (usando contestações como base)
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return this.makeRequest<Notification[]>('/rest/v1/contestacoes', { baseUrl: SUPABASE_REST_URL });
  }

  async markNotificationAsRead(id: string): Promise<ApiResponse<Notification>> {
    return this.makeRequest<Notification>(`/rest/v1/contestacoes?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Upload de fotos usando API Grifo com fallback
  async uploadPhoto(file: File | Blob, filename: string): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file, filename);
    
    return this.makeRequest<{ url: string; filename: string }>('/api/fotos/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type para permitir que o browser defina o boundary
        ...this.getHeaders(),
        'Content-Type': undefined as any,
      }
    });
  }

  async getPhoto(id: string): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>(`/api/fotos/${id}`);
  }

  async deletePhoto(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/fotos/${id}`, {
      method: 'DELETE'
    });
  }

  // Upload de arquivos genérico (fallback para Supabase Storage)
  async uploadFile(file: File | Blob, filename: string): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file, filename);
    
    const uploadPath = `uploads/${Date.now()}_${filename}`;
    
    return this.makeRequest<{ url: string; filename: string }>(`/storage/v1/object/vistorias/${uploadPath}`, {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type para permitir que o browser defina o boundary
        ...this.getHeaders(),
        'Content-Type': undefined as any,
      },
      baseUrl: 'https://fsvwifbvehdhlufauahj.supabase.co',
      useGrifoFirst: false
    });
  }

  // Relatórios usando RPC functions
  async exportData(type: string, filters?: any): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>('/rest/v1/rpc/usage_stats', {
      method: 'POST',
      body: JSON.stringify({ export_format: type, filters }),
      baseUrl: SUPABASE_REST_URL
    });
  }

  async getReports(filters?: any): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/rest/v1/rpc/usage_stats', {
      method: 'POST',
      body: JSON.stringify({ filters }),
      baseUrl: SUPABASE_REST_URL
    });
  }

  // Dashboard KPIs usando API Grifo com fallback
  async getDashboard(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/api/dashboard/kpis');
  }

  // Empresas usando API Grifo com fallback
  async getEmpresas(): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/api/empresas');
  }

  async createEmpresa(empresa: any): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/api/empresas', {
      method: 'POST',
      body: JSON.stringify(empresa)
    });
  }

  async getEmpresa(id: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(`/api/empresas/${id}`);
  }

  // Usuários usando API Grifo com fallback
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.makeRequest<User[]>('/api/users/profile');
  }

  async updateUserProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async getUserPermissions(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/api/users/permissions');
  }

  async getContestations(): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/rest/v1/contestacoes', { baseUrl: SUPABASE_REST_URL });
  }

  // Verificar conectividade
  async checkHealth(): Promise<ApiResponse<{ status: string; version: string }>> {
    try {
      const response = await this.makeRequest<any[]>('/rest/v1/empresas?limit=1', { baseUrl: 'https://fsvwifbvehdhlufauahj.supabase.co' });
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

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  // Obter usuário atual
  async getCurrentUser(): Promise<ApiResponse<User>> {
    if (!this.authToken) {
      return {
        success: false,
        error: 'Não autenticado'
      };
    }

    // Primeiro tenta a API Grifo
    if (this.useGrifoApi) {
      try {
        const response = await fetch(`${this.baseUrl}/api/users/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          return {
            success: true,
            data: data
          };
        }

        // Se falhar, tenta Supabase como fallback
        console.warn('API Grifo getCurrentUser failed, trying Supabase fallback');
      } catch (error) {
        console.warn('API Grifo connection failed, trying Supabase fallback:', error);
      }
    }

    // Fallback para Supabase Auth
    try {
      const response = await fetch(`${SUPABASE_AUTH_URL}/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Token expirado ou inválido
        await this.clearAuthToken();
        return {
          success: false,
          error: 'Sessão expirada'
        };
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Get current user error:', error);
      await this.clearAuthToken();
      return {
        success: false,
        error: 'Erro ao obter usuário atual'
      };
    }
  }
}

// Instância singleton
const grifoApiService = new GrifoApiService();

export default grifoApiService;
export type {
  ApiResponse,
  SyncData,
  Inspection,
  Property,
  Notification,
  User,
};