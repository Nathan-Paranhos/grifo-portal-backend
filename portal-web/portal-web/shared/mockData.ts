// Dados mock para modo de demonstração
// Este arquivo contém dados fictícios para demonstrar as funcionalidades do sistema

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  empresa_id: string;
}

export interface MockEmpresa {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
}

export interface MockImovel {
  id: string;
  endereco: string;
  tipo: string;
  area: number;
  quartos?: number;
  banheiros?: number;
  empresa_id: string;
}

export interface MockVistoria {
  id: string;
  imovel_id: string;
  vistoriador_id: string;
  empresa_id: string;
  tipo: 'entrada' | 'saida' | 'comercial' | 'industrial' | 'seguro';
  status: 'agendada' | 'em_andamento' | 'finalizada' | 'cancelada';
  data_agendada: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

export interface MockItemVistoria {
  id: string;
  vistoria_id: string;
  ambiente: string;
  item: string;
  estado: 'otimo' | 'bom' | 'regular' | 'ruim';
  observacoes: string;
  foto_url?: string;
  created_at: string;
}

// Dados mock
export const mockEmpresas: MockEmpresa[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    nome: 'Grifo Vistorias SP',
    cnpj: '12.345.678/0001-90',
    telefone: '(11) 3456-7890',
    email: 'contato@grifovistoriassp.com.br'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    nome: 'Vistoria Express RJ',
    cnpj: '98.765.432/0001-10',
    telefone: '(21) 2345-6789',
    email: 'info@vistoriaexpressrj.com.br'
  }
];

export const mockUsers: MockUser[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'João Silva',
    email: 'joao.silva@grifovistoriassp.com.br',
    role: 'vistoriador',
    empresa_id: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Maria Santos',
    email: 'maria.santos@grifovistoriassp.com.br',
    role: 'admin',
    empresa_id: '550e8400-e29b-41d4-a716-446655440001'
  }
];

export const mockImoveis: MockImovel[] = [
  {
    id: 'imovel-001',
    endereco: 'Rua das Flores, 123 - Vila Madalena, São Paulo - SP',
    tipo: 'apartamento',
    area: 85,
    quartos: 2,
    banheiros: 2,
    empresa_id: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'imovel-002',
    endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    tipo: 'apartamento',
    area: 120,
    quartos: 3,
    banheiros: 2,
    empresa_id: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'imovel-003',
    endereco: 'Rua Oscar Freire, 500 - Jardins, São Paulo - SP',
    tipo: 'cobertura',
    area: 200,
    quartos: 4,
    banheiros: 3,
    empresa_id: '550e8400-e29b-41d4-a716-446655440001'
  }
];

export const mockVistorias: MockVistoria[] = [
  {
    id: 'vistoria-001',
    imovel_id: 'imovel-001',
    vistoriador_id: '550e8400-e29b-41d4-a716-446655440011',
    empresa_id: '550e8400-e29b-41d4-a716-446655440001',
    tipo: 'entrada',
    status: 'agendada',
    data_agendada: '2024-01-25 09:00:00',
    observacoes: 'Vistoria de entrada para novo inquilino. Verificar estado geral do imóvel.',
    created_at: '2024-01-20 10:30:00',
    updated_at: '2024-01-20 10:30:00'
  },
  {
    id: 'vistoria-002',
    imovel_id: 'imovel-002',
    vistoriador_id: '550e8400-e29b-41d4-a716-446655440012',
    empresa_id: '550e8400-e29b-41d4-a716-446655440001',
    tipo: 'entrada',
    status: 'em_andamento',
    data_agendada: '2024-01-24 14:00:00',
    observacoes: 'Apartamento de alto padrão. Atenção especial aos acabamentos.',
    created_at: '2024-01-22 08:15:00',
    updated_at: '2024-01-24 14:30:00'
  },
  {
    id: 'vistoria-003',
    imovel_id: 'imovel-003',
    vistoriador_id: '550e8400-e29b-41d4-a716-446655440011',
    empresa_id: '550e8400-e29b-41d4-a716-446655440001',
    tipo: 'saida',
    status: 'finalizada',
    data_agendada: '2024-01-20 10:00:00',
    observacoes: 'Cobertura nos Jardins. Vistoria completa realizada.',
    created_at: '2024-01-18 16:20:00',
    updated_at: '2024-01-20 17:45:00'
  }
];

export const mockItensVistoria: MockItemVistoria[] = [
  {
    id: 'item-001',
    vistoria_id: 'vistoria-003',
    ambiente: 'Sala de Estar',
    item: 'Piso de madeira',
    estado: 'bom',
    observacoes: 'Piso em excelente estado, sem riscos ou manchas',
    created_at: '2024-01-20 10:30:00'
  },
  {
    id: 'item-002',
    vistoria_id: 'vistoria-003',
    ambiente: 'Cozinha',
    item: 'Bancada de granito',
    estado: 'bom',
    observacoes: 'Pequeno risco na bancada, mas em bom estado geral',
    created_at: '2024-01-20 11:00:00'
  },
  {
    id: 'item-003',
    vistoria_id: 'vistoria-003',
    ambiente: 'Banheiro Social',
    item: 'Revestimento cerâmico',
    estado: 'regular',
    observacoes: 'Algumas peças soltas, necessário reparo',
    created_at: '2024-01-20 11:30:00'
  }
];

// Dados para dashboard
export const mockDashboardData = {
  vistorias: 45,
  concluidas: 32,
  pendentes: 8,
  contestadas: 5,
  imoveis: 128,
  usuarios: 12,
  empresas: 3
};

// Função para obter dados mock baseado no tipo
export const getMockData = (type: string) => {
  switch (type) {
    case 'empresas':
      return mockEmpresas;
    case 'users':
      return mockUsers;
    case 'imoveis':
      return mockImoveis;
    case 'vistorias':
      return mockVistorias;
    case 'itens_vistoria':
      return mockItensVistoria;
    case 'dashboard':
      return mockDashboardData;
    default:
      return [];
  }
};

// Função para simular delay de API
export const simulateApiDelay = (ms: number = 500) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};