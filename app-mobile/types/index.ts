export interface User {
  id: string;
  email: string;
  role: 'vistoriador' | 'corretor' | 'admin' | 'superadmin';
  empresa_id: string;
  nome: string;
  created_at: string;
}

export interface Empresa {
  id: string;
  nome: string;
  logo_url?: string;
  created_at: string;
}

export interface Imovel {
  id: string;
  empresa_id: string;
  endereco: string;
  tipo: 'apartamento' | 'casa' | 'comercial';
  codigo: string;
  proprietario: string;
  created_at: string;
}

export interface Vistoria {
  id: string;
  empresa_id: string;
  imovel_id: string;
  vistoriador_id: string;
  tipo: 'entrada' | 'saida' | 'periodica';
  status: 'rascunho' | 'finalizada' | 'contestada';
  pdf_url?: string;
  contestacao_token?: string;
  created_at: string;
  updated_at: string;
}

export interface DraftVistoria {
  id: string;
  empresa_id: string;
  imovel_id: string;
  tipo: 'entrada' | 'saida' | 'periodica';
  ambientes: DraftAmbiente[];
  synced: boolean;
  status?: 'pending_sync' | 'synced' | 'error';
  created_at: string;
}

export interface DraftAmbiente {
  id: string;
  nome: string;
  comentario: string;
  fotos: LocalPhoto[];
  ordem: number;
}

export interface LocalPhoto {
  id: string;
  uri: string;
  comentario: string;
  ordem: number;
  uploaded: boolean;
  storage_path?: string;
}

export interface FileUploadQueue {
  id: string;
  local_path: string;
  storage_path: string;
  type: 'photo' | 'pdf';
  vistoria_id: string;
  try_count: number;
  pending: boolean;
  created_at: string;
}

export interface SyncStats {
  pendingPhotos: number;
  pendingPdfs: number;
  completedToday: number;
  averageUploadTime: number;
}