# Plano de Implementação - Migração para Produção

## 1. Visão Geral da Migração

Este documento detalha o plano completo para migrar o Sistema Grifo do modo demonstração para um ambiente de produção completo, incluindo todas as funcionalidades solicitadas: autenticação robusta, integração Google Drive, autonomia de vistorias, assinatura digital, descrições editáveis e modelos de laudo diversificados.

### 1.1 Objetivos da Migração

- **Desativar completamente o modo demonstração**
- **Implementar autenticação e autorização robustas**
- **Integrar sincronização com Google Drive**
- **Adicionar autonomia para criação de vistorias**
- **Implementar módulo de assinatura digital**
- **Criar sistema de descrições editáveis por categoria**
- **Desenvolver modelos de laudo diversificados**

### 1.2 Cronograma Geral

| Fase | Duração | Descrição |
|------|---------|----------|
| Fase 1 | 3 dias | Desativação do modo demo e restauração da autenticação |
| Fase 2 | 5 dias | Integração Google Drive e sistema de sincronização |
| Fase 3 | 4 dias | Autonomia de vistorias e workflow completo |
| Fase 4 | 3 dias | Módulo de assinatura digital (DocuSign) |
| Fase 5 | 4 dias | Sistema de descrições editáveis por ambiente |
| Fase 6 | 3 dias | Modelos de laudo diversificados |
| Fase 7 | 3 dias | Testes integrados e deploy |
| **Total** | **25 dias** | **Implementação completa** |

## 2. Fase 1: Desativação do Modo Demo e Autenticação (3 dias)

### 2.1 Dia 1: Remoção do Modo Demo

**Arquivos a serem modificados:**

1. **API - Remover bypass de autenticação**
   - `src/middleware/auth.js` - Remover condição DEMO_MODE
   - `src/routes/auth.js` - Restaurar validação completa
   - `.env` - Definir DEMO_MODE=false

2. **App Mobile - Restaurar AuthGuard**
   - `src/components/AuthGuard.tsx` - Remover bypass
   - `src/screens/LoginScreen.tsx` - Restaurar formulário completo
   - `.env` - Definir EXPO_PUBLIC_DEMO_MODE=false

3. **Portal Web - Restaurar autenticação**
   - `app/layout.tsx` - Remover bypass de autenticação
   - `middleware.ts` - Restaurar proteção de rotas
   - `.env.local` - Definir NEXT_PUBLIC_DEMO_MODE=false

**Código de exemplo para remoção:**

```typescript
// src/middleware/auth.js - ANTES (modo demo)
const authMiddleware = (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') {
    req.user = { id: 'demo-user', role: 'inspetor' };
    return next();
  }
  // validação real...
};

// src/middleware/auth.js - DEPOIS (produção)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token de acesso obrigatório' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
```

### 2.2 Dia 2: Sistema de Permissões Granulares

**Implementar middleware de autorização:**

```typescript
// src/middleware/permissions.js
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user;
    
    // Admin tem todas as permissões
    if (user.role === 'admin') {
      return next();
    }
    
    // Verificar permissão específica
    if (!user.permissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: 'Permissão insuficiente',
        required: requiredPermission 
      });
    }
    
    next();
  };
};

// Uso nas rotas
app.post('/api/vistorias', 
  authMiddleware, 
  checkPermission('create_vistoria'), 
  createVistoria
);
```

**Definir estrutura de permissões:**

```sql
-- Atualizar tabela de usuários com permissões
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

-- Inserir permissões padrão por role
UPDATE users SET permissions = '[
  "view_vistorias",
  "create_vistoria", 
  "edit_own_vistoria",
  "upload_photos",
  "generate_laudo"
]' WHERE role = 'inspetor';

UPDATE users SET permissions = '[
  "view_all_vistorias",
  "create_vistoria",
  "edit_any_vistoria", 
  "manage_users",
  "view_reports"
]' WHERE role = 'empresa';

UPDATE users SET permissions = '["*"]' WHERE role = 'admin';
```

### 2.3 Dia 3: Testes de Autenticação

**Criar testes automatizados:**

```typescript
// __tests__/auth.test.ts
describe('Authentication System', () => {
  test('should reject requests without token', async () => {
    const response = await request(app)
      .get('/api/vistorias')
      .expect(401);
    
    expect(response.body.error).toBe('Token de acesso obrigatório');
  });
  
  test('should accept valid token', async () => {
    const token = generateTestToken({ id: 'user1', role: 'inspetor' });
    
    const response = await request(app)
      .get('/api/vistorias')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
  
  test('should check permissions correctly', async () => {
    const token = generateTestToken({ 
      id: 'user1', 
      role: 'cliente',
      permissions: ['view_vistorias'] 
    });
    
    await request(app)
      .post('/api/vistorias')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
```

## 3. Fase 2: Integração Google Drive (5 dias)

### 3.1 Dia 1: Configuração da API Google Drive

**Instalar dependências:**
```bash
npm install googleapis multer sharp
```

**Configurar credenciais:**
```typescript
// src/services/googleDrive.js
import { google } from 'googleapis';

class GoogleDriveService {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }
  
  async createFolder(name, parentId = null) {
    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    };
    
    const response = await this.drive.files.create({
      resource: fileMetadata,
      fields: 'id, name, webViewLink'
    });
    
    return response.data;
  }
  
  async uploadFile(filePath, fileName, parentId, mimeType) {
    const fileMetadata = {
      name: fileName,
      parents: [parentId]
    };
    
    const media = {
      mimeType,
      body: fs.createReadStream(filePath)
    };
    
    const response = await this.drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink'
    });
    
    return response.data;
  }
}

export default new GoogleDriveService();
```

### 3.2 Dia 2: Sistema de Upload e Sincronização

**Middleware de upload:**
```typescript
// src/middleware/upload.js
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = `uploads/${req.user.id}/${Date.now()}`;
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// Processamento de imagem
const processImage = async (filePath) => {
  const outputPath = filePath.replace(/\.[^/.]+$/, '_processed.jpg');
  const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
  
  // Redimensionar imagem principal
  await sharp(filePath)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);
  
  // Criar thumbnail
  await sharp(filePath)
    .resize(300, 200, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toFile(thumbnailPath);
  
  return { outputPath, thumbnailPath };
};

export { upload, processImage };
```

**Rota de upload com sincronização:**
```typescript
// src/routes/fotos.js
app.post('/api/fotos/upload', 
  authMiddleware,
  upload.array('fotos', 10),
  async (req, res) => {
    try {
      const { ambienteId } = req.body;
      const uploadedFiles = [];
      
      for (const file of req.files) {
        // Processar imagem
        const { outputPath, thumbnailPath } = await processImage(file.path);
        
        // Salvar no banco
        const foto = await db.fotos.create({
          ambiente_id: ambienteId,
          filename: file.filename,
          url_local: outputPath,
          thumbnail_url: thumbnailPath,
          tamanho_bytes: file.size,
          sync_status: 'pending'
        });
        
        uploadedFiles.push(foto);
        
        // Agendar sincronização com Google Drive
        await syncQueue.add('sync-photo', {
          fotoId: foto.id,
          filePath: outputPath,
          thumbnailPath
        });
      }
      
      res.json({ success: true, fotos: uploadedFiles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
```

### 3.3 Dia 3: Queue de Sincronização

**Configurar Bull Queue:**
```typescript
// src/queues/syncQueue.js
import Bull from 'bull';
import googleDriveService from '../services/googleDrive.js';

const syncQueue = new Bull('sync queue', process.env.REDIS_URL);

syncQueue.process('sync-photo', async (job) => {
  const { fotoId, filePath, thumbnailPath } = job.data;
  
  try {
    // Buscar dados da foto e vistoria
    const foto = await db.fotos.findById(fotoId);
    const ambiente = await db.ambientes.findById(foto.ambiente_id);
    const vistoria = await db.vistorias.findById(ambiente.vistoria_id);
    
    // Criar estrutura de pastas no Drive
    const vistoriaFolder = await googleDriveService.createFolder(
      `Vistoria ${vistoria.numero}`,
      process.env.GOOGLE_DRIVE_ROOT_FOLDER
    );
    
    const ambienteFolder = await googleDriveService.createFolder(
      ambiente.nome,
      vistoriaFolder.id
    );
    
    // Upload da imagem principal
    const uploadedFile = await googleDriveService.uploadFile(
      filePath,
      foto.filename,
      ambienteFolder.id,
      'image/jpeg'
    );
    
    // Upload do thumbnail
    const uploadedThumb = await googleDriveService.uploadFile(
      thumbnailPath,
      `thumb_${foto.filename}`,
      ambienteFolder.id,
      'image/jpeg'
    );
    
    // Atualizar banco de dados
    await db.fotos.update(fotoId, {
      url_drive: uploadedFile.webContentLink,
      sync_status: 'synced',
      synced_at: new Date()
    });
    
    // Log de sincronização
    await db.sync_logs.create({
      vistoria_id: vistoria.id,
      service: 'google_drive',
      operation: 'upload_photo',
      status: 'completed',
      details: {
        foto_id: fotoId,
        drive_file_id: uploadedFile.id,
        drive_folder_id: ambienteFolder.id
      }
    });
    
  } catch (error) {
    // Marcar como erro
    await db.fotos.update(fotoId, {
      sync_status: 'error'
    });
    
    await db.sync_logs.create({
      vistoria_id: vistoria.id,
      service: 'google_drive',
      operation: 'upload_photo',
      status: 'error',
      error_message: error.message
    });
    
    throw error;
  }
});

export default syncQueue;
```

### 3.4 Dia 4: Interface de Sincronização

**Componente de status de sync (React Native):**
```typescript
// app-mobile/src/components/SyncStatus.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SyncStatusProps {
  vistoriaId: string;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ vistoriaId }) => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const checkSyncStatus = async () => {
    try {
      const response = await api.get(`/sync/status/${vistoriaId}`);
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Erro ao verificar status de sync:', error);
    }
  };
  
  const forcSync = async () => {
    setIsLoading(true);
    try {
      await api.post('/sync/drive', {
        vistoriaId,
        items: ['fotos', 'laudos'],
        forceSync: true
      });
      await checkSyncStatus();
    } catch (error) {
      console.error('Erro ao forçar sincronização:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [vistoriaId]);
  
  const getStatusIcon = () => {
    if (isLoading) return 'sync';
    if (syncStatus?.allSynced) return 'cloud-done';
    if (syncStatus?.hasErrors) return 'cloud-offline';
    return 'cloud-upload';
  };
  
  const getStatusColor = () => {
    if (isLoading) return '#FFA500';
    if (syncStatus?.allSynced) return '#4CAF50';
    if (syncStatus?.hasErrors) return '#F44336';
    return '#2196F3';
  };
  
  return (
    <View className="flex-row items-center p-3 bg-gray-50 rounded-lg">
      <Ionicons 
        name={getStatusIcon()} 
        size={24} 
        color={getStatusColor()}
        className={isLoading ? 'animate-spin' : ''}
      />
      <View className="flex-1 ml-3">
        <Text className="font-semibold">
          {syncStatus?.allSynced ? 'Sincronizado' : 'Sincronizando...'}
        </Text>
        <Text className="text-sm text-gray-600">
          {syncStatus?.pendingItems || 0} itens pendentes
        </Text>
      </View>
      <TouchableOpacity 
        onPress={forcSync}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-500 rounded"
      >
        <Text className="text-white text-sm">Sincronizar</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SyncStatus;
```

### 3.5 Dia 5: Testes de Integração Google Drive

**Testes automatizados:**
```typescript
// __tests__/googleDrive.test.ts
describe('Google Drive Integration', () => {
  test('should create folder structure', async () => {
    const folder = await googleDriveService.createFolder('Test Vistoria');
    expect(folder).toHaveProperty('id');
    expect(folder.name).toBe('Test Vistoria');
  });
  
  test('should upload file successfully', async () => {
    const testFile = path.join(__dirname, 'fixtures/test-image.jpg');
    const parentFolder = await googleDriveService.createFolder('Test Upload');
    
    const uploadedFile = await googleDriveService.uploadFile(
      testFile,
      'test-image.jpg',
      parentFolder.id,
      'image/jpeg'
    );
    
    expect(uploadedFile).toHaveProperty('id');
    expect(uploadedFile).toHaveProperty('webContentLink');
  });
  
  test('should handle sync queue correctly', async () => {
    const job = await syncQueue.add('sync-photo', {
      fotoId: 'test-foto-id',
      filePath: '/path/to/test.jpg',
      thumbnailPath: '/path/to/thumb.jpg'
    });
    
    expect(job).toHaveProperty('id');
    expect(job.data.fotoId).toBe('test-foto-id');
  });
});
```

## 4. Fase 3: Autonomia de Vistorias (4 dias)

### 4.1 Dia 1: Interface de Criação Autônoma

**Tela de nova vistoria (React Native):**
```typescript
// app-mobile/src/screens/NovaVistoriaScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const NovaVistoriaScreen = () => {
  const [formData, setFormData] = useState({
    tipo: 'residencial',
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: ''
    },
    escopo: [],
    agendamento: new Date(),
    observacoes: ''
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const escopoOptions = [
    { id: 'estrutural', label: 'Análise Estrutural', selected: false },
    { id: 'eletrica', label: 'Instalações Elétricas', selected: false },
    { id: 'hidraulica', label: 'Instalações Hidráulicas', selected: false },
    { id: 'acabamentos', label: 'Acabamentos', selected: false },
    { id: 'esquadrias', label: 'Esquadrias', selected: false },
    { id: 'cobertura', label: 'Cobertura', selected: false }
  ];
  
  const buscarCEP = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: {
              ...prev.endereco,
              cep,
              logradouro: data.logradouro,
              bairro: data.bairro,
              cidade: data.localidade,
              uf: data.uf
            }
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };
  
  const criarVistoria = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/vistorias/autonoma', formData);
      
      // Navegar para a tela da vistoria criada
      navigation.navigate('VistoriaDetalhes', { 
        vistoriaId: response.data.id 
      });
    } catch (error) {
      console.error('Erro ao criar vistoria:', error);
      Alert.alert('Erro', 'Não foi possível criar a vistoria');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold mb-6">Nova Vistoria</Text>
      
      {/* Tipo de Vistoria */}
      <View className="mb-4">
        <Text className="text-lg font-semibold mb-2">Tipo de Vistoria</Text>
        <Picker
          selectedValue={formData.tipo}
          onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
          className="border border-gray-300 rounded"
        >
          <Picker.Item label="Residencial" value="residencial" />
          <Picker.Item label="Comercial" value="comercial" />
          <Picker.Item label="Industrial" value="industrial" />
        </Picker>
      </View>
      
      {/* Endereço */}
      <View className="mb-4">
        <Text className="text-lg font-semibold mb-2">Endereço</Text>
        
        <TextInput
          placeholder="CEP"
          value={formData.endereco.cep}
          onChangeText={(text) => {
            const cep = text.replace(/\D/g, '');
            setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, cep }
            }));
            if (cep.length === 8) buscarCEP(cep);
          }}
          className="border border-gray-300 rounded p-3 mb-2"
          maxLength={8}
          keyboardType="numeric"
        />
        
        <TextInput
          placeholder="Logradouro"
          value={formData.endereco.logradouro}
          onChangeText={(text) => setFormData(prev => ({
            ...prev,
            endereco: { ...prev.endereco, logradouro: text }
          }))}
          className="border border-gray-300 rounded p-3 mb-2"
        />
        
        <View className="flex-row gap-2 mb-2">
          <TextInput
            placeholder="Número"
            value={formData.endereco.numero}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, numero: text }
            }))}
            className="flex-1 border border-gray-300 rounded p-3"
          />
          
          <TextInput
            placeholder="Complemento"
            value={formData.endereco.complemento}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, complemento: text }
            }))}
            className="flex-2 border border-gray-300 rounded p-3"
          />
        </View>
        
        <View className="flex-row gap-2">
          <TextInput
            placeholder="Bairro"
            value={formData.endereco.bairro}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, bairro: text }
            }))}
            className="flex-2 border border-gray-300 rounded p-3"
          />
          
          <TextInput
            placeholder="Cidade"
            value={formData.endereco.cidade}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, cidade: text }
            }))}
            className="flex-2 border border-gray-300 rounded p-3"
          />
          
          <TextInput
            placeholder="UF"
            value={formData.endereco.uf}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              endereco: { ...prev.endereco, uf: text.toUpperCase() }
            }))}
            className="flex-1 border border-gray-300 rounded p-3"
            maxLength={2}
          />
        </View>
      </View>
      
      {/* Escopo */}
      <View className="mb-4">
        <Text className="text-lg font-semibold mb-2">Escopo da Vistoria</Text>
        {escopoOptions.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => {
              const isSelected = formData.escopo.includes(item.id);
              setFormData(prev => ({
                ...prev,
                escopo: isSelected 
                  ? prev.escopo.filter(id => id !== item.id)
                  : [...prev.escopo, item.id]
              }));
            }}
            className={`flex-row items-center p-3 mb-2 rounded ${
              formData.escopo.includes(item.id) 
                ? 'bg-blue-100 border-blue-500' 
                : 'bg-gray-50 border-gray-300'
            } border`}
          >
            <View className={`w-5 h-5 rounded mr-3 ${
              formData.escopo.includes(item.id) 
                ? 'bg-blue-500' 
                : 'bg-white border border-gray-400'
            }`} />
            <Text className={formData.escopo.includes(item.id) ? 'text-blue-700' : 'text-gray-700'}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Agendamento */}
      <View className="mb-4">
        <Text className="text-lg font-semibold mb-2">Agendamento</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="border border-gray-300 rounded p-3"
        >
          <Text>{formData.agendamento.toLocaleDateString('pt-BR')} às {formData.agendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={formData.agendamento}
            mode="datetime"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setFormData(prev => ({ ...prev, agendamento: selectedDate }));
              }
            }}
            minimumDate={new Date()}
          />
        )}
      </View>
      
      {/* Observações */}
      <View className="mb-6">
        <Text className="text-lg font-semibold mb-2">Observações</Text>
        <TextInput
          placeholder="Observações adicionais sobre a vistoria..."
          value={formData.observacoes}
          onChangeText={(text) => setFormData(prev => ({ ...prev, observacoes: text }))}
          className="border border-gray-300 rounded p-3 h-24"
          multiline
          textAlignVertical="top"
        />
      </View>
      
      {/* Botão Criar */}
      <TouchableOpacity
        onPress={criarVistoria}
        disabled={isLoading || !formData.endereco.cep || formData.escopo.length === 0}
        className={`p-4 rounded-lg ${
          isLoading || !formData.endereco.cep || formData.escopo.length === 0
            ? 'bg-gray-400'
            : 'bg-blue-500'
        }`}
      >
        <Text className="text-white text-center text-lg font-semibold">
          {isLoading ? 'Criando...' : 'Criar Vistoria'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default NovaVistoriaScreen;
```

### 4.2 Dia 2: API de Criação Autônoma

**Endpoint para criação autônoma:**
```typescript
// src/routes/vistorias.js
app.post('/api/vistorias/autonoma', 
  authMiddleware,
  checkPermission('create_vistoria'),
  async (req, res) => {
    try {
      const { tipo, endereco, escopo, agendamento, observacoes } = req.body;
      const userId = req.user.id;
      const empresaId = req.user.empresaId;
      
      // Validar dados obrigatórios
      if (!tipo || !endereco || !escopo || escopo.length === 0) {
        return res.status(400).json({
          error: 'Dados obrigatórios: tipo, endereco e escopo'
        });
      }
      
      // Criar vistoria
      const vistoria = await db.vistorias.create({
        user_id: userId,
        empresa_id: empresaId,
        tipo,
        endereco,
        escopo,
        status: agendamento ? 'agendada' : 'criada',
        agendamento: agendamento ? new Date(agendamento) : null,
        observacoes
      });
      
      // Criar ambientes padrão baseado no escopo
      const ambientesPadrao = await criarAmbientesPadrao(vistoria.id, tipo, escopo);
      
      // Agendar notificações se necessário
      if (agendamento) {
        await agendarNotificacoes(vistoria.id, new Date(agendamento));
      }
      
      // Criar pasta no Google Drive
      await syncQueue.add('create-vistoria-folder', {
        vistoriaId: vistoria.id,
        vistoriaNumero: vistoria.numero
      });
      
      res.json({
        success: true,
        vistoria: {
          ...vistoria,
          ambientes: ambientesPadrao,
          qrCode: `${process.env.APP_URL}/vistoria/${vistoria.qr_code}`
        }
      });
      
    } catch (error) {
      console.error('Erro ao criar vistoria autônoma:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// Função para criar ambientes padrão
const criarAmbientesPadrao = async (vistoriaId, tipo, escopo) => {
  const ambientesPorTipo = {
    residencial: [
      { nome: 'Sala de Estar', tipo: 'social' },
      { nome: 'Cozinha', tipo: 'servico' },
      { nome: 'Quarto Principal', tipo: 'intimo' },
      { nome: 'Banheiro', tipo: 'servico' },
      { nome: 'Área Externa', tipo: 'externo' }
    ],
    comercial: [
      { nome: 'Recepção', tipo: 'social' },
      { nome: 'Sala Comercial', tipo: 'trabalho' },
      { nome: 'Banheiro', tipo: 'servico' },
      { nome: 'Copa', tipo: 'servico' },
      { nome: 'Área Externa', tipo: 'externo' }
    ],
    industrial: [
      { nome: 'Área de Produção', tipo: 'producao' },
      { nome: 'Escritório', tipo: 'administrativo' },
      { nome: 'Almoxarifado', tipo: 'estoque' },
      { nome: 'Vestiário', tipo: 'servico' },
      { nome: 'Área Externa', tipo: 'externo' }
    ]
  };
  
  const ambientes = ambientesPorTipo[tipo] || ambientesPorTipo.residencial;
  const ambientesCriados = [];
  
  for (let i = 0; i < ambientes.length; i++) {
    const ambiente = await db.ambientes.create({
      vistoria_id: vistoriaId,
      nome: ambientes[i].nome,
      tipo: ambientes[i].tipo,
      ordem: i + 1
    });
    
    // Criar descrições padrão para cada categoria
    await criarDescricoesPadrao(ambiente.id, escopo);
    
    ambientesCriados.push(ambiente);
  }
  
  return ambientesCriados;
};

// Função para criar descrições padrão
const criarDescricoesPadrao = async (ambienteId, escopo) => {
  const categorias = ['teto', 'piso', 'paredes', 'esquadrias', 'iluminacao', 'mobiliario', 'planejados', 'eletros'];
  
  for (const categoria of categorias) {
    await db.descricoes.create({
      ambiente_id: ambienteId,
      categoria,
      descricao: `Descrição do ${categoria} a ser preenchida durante a vistoria`,
      detalhes: {
        estado: null,
        material: null,
        cor: null,
        observacoes: null
      }
    });
  }
};

// Função para agendar notificações
const agendarNotificacoes = async (vistoriaId, dataAgendamento) => {
  const vistoria = await db.vistorias.findById(vistoriaId);
  const user = await db.users.findById(vistoria.user_id);
  
  // Notificação 1 dia antes
  const umDiaAntes = new Date(dataAgendamento);
  umDiaAntes.setDate(umDiaAntes.getDate() - 1);
  
  await notificationQueue.add('send-notification', {
    userId: user.id,
    tipo: 'vistoria_lembrete',
    titulo: 'Vistoria Agendada para Amanhã',
    mensagem: `Você tem uma vistoria agendada para amanhã às ${dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    dados: { vistoriaId }
  }, {
    delay: umDiaAntes.getTime() - Date.now()
  });
  
  // Notificação 1 hora antes
  const umaHoraAntes = new Date(dataAgendamento);
  umaHoraAntes.setHours(umaHoraAntes.getHours() - 1);
  
  await notificationQueue.add('send-notification', {
    userId: user.id,
    tipo: 'vistoria_iminente',
    titulo: 'Vistoria em 1 Hora',
    mensagem: 'Sua vistoria está agendada para daqui a 1 hora. Prepare-se!',
    dados: { vistoriaId }
  }, {
    delay: umaHoraAntes.getTime() - Date.now()
  });
};
```

### 4.3 Dia 3: Sistema de Agendamento

**Componente de calendário:**
```typescript
// app-mobile/src/components/CalendarioVistorias.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface CalendarioVistoriasProps {
  onDateSelect: (date: string) => void;
  vistoriasAgendadas: any[];
}

const CalendarioVistorias: React.FC<CalendarioVistoriasProps> = ({ 
  onDateSelect, 
  vistoriasAgendadas 
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});
  
  useEffect(() => {
    // Marcar datas com vistorias agendadas
    const marked = {};
    
    vistoriasAgendadas.forEach(vistoria => {
      const date = vistoria.agendamento.split('T')[0];
      marked[date] = {
        marked: true,
        dotColor: '#2196F3',
        selectedColor: '#2196F3'
      };
    });
    
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#2196F3'
      };
    }
    
    setMarkedDates(marked);
  }, [vistoriasAgendadas, selectedDate]);
  
  const handleDatePress = (day) => {
    setSelectedDate(day.dateString);
    onDateSelect(day.dateString);
  };
  
  const getVistoriasDoDia = (date: string) => {
    return vistoriasAgendadas.filter(vistoria => 
      vistoria.agendamento.startsWith(date)
    );
  };
  
  return (
    <View className="flex-1">
      <Calendar
        onDayPress={handleDatePress}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: '#2196F3',
          todayTextColor: '#2196F3',
          arrowColor: '#2196F3',
          monthTextColor: '#2196F3',
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600'
        }}
        minDate={new Date().toISOString().split('T')[0]}
      />
      
      {selectedDate && (
        <View className="p-4">
          <Text className="text-lg font-bold mb-3">
            Vistorias em {new Date(selectedDate).toLocaleDateString('pt-BR')}
          </Text>
          
          <ScrollView className="max-h-48">
            {getVistoriasDoDia(selectedDate).map(vistoria => (
              <TouchableOpacity
                key={vistoria.id}
                className="p-3 mb-2 bg-blue-50 rounded-lg border border-blue-200"
                onPress={() => navigation.navigate('VistoriaDetalhes', { vistoriaId: vistoria.id })}
              >
                <Text className="font-semibold text-blue-800">
                  {vistoria.numero}
                </Text>
                <Text className="text-blue-600">
                  {new Date(vistoria.agendamento).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
                <Text className="text-gray-600 text-sm">
                  {vistoria.endereco.logradouro}, {vistoria.endereco.numero}
                </Text>
                <View className="flex-row mt-1">
                  <View className={`px-2 py-1 rounded text-xs ${
                    vistoria.status === 'agendada' ? 'bg-yellow-200 text-yellow-800' :
                    vistoria.status === 'em_andamento' ? 'bg-blue-200 text-blue-800' :
                    vistoria.status === 'concluida' ? 'bg-green-200 text-green-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    <Text className="text-xs">
                      {vistoria.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            
            {getVistoriasDoDia(selectedDate).length === 0 && (
              <Text className="text-gray-500 text-center py-4">
                Nenhuma vistoria agendada para este dia
              </Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default CalendarioVistorias;
```

### 4.4 Dia 4: Workflow Completo e Notificações

**Sistema de notificações:**
```typescript
// src/services/notificationService.js
import { Expo } from 'expo-server-sdk';
import sgMail from '@sendgrid/mail';

class NotificationService {
  constructor() {
    this.expo = new Expo();
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
  
  async sendPushNotification(userId, title, body, data = {}) {
    try {
      const user = await db.users.findById(userId);
      if (!user.push_token) return;
      
      const messages = [{
        to: user.push_token,
        sound: 'default',
        title,
        body,
        data
      }];
      
      const chunks = this.expo.chunkPushNotifications(messages);
      
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
      
      // Salvar notificação no banco
      await db.notificacoes.create({
        user_id: userId,
        tipo: 'push',
        titulo: title,
        mensagem: body,
        dados: data,
        enviada: true
      });
      
    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
    }
  }
  
  async sendEmail(to, subject, html, attachments = []) {
    try {
      const msg = {
        to,
        from: process.env.FROM_EMAIL,
        subject,
        html,
        attachments
      };
      
      await sgMail.send(msg);
      
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }
  }
  
  async notifyVistoriaCreated(vistoriaId) {
    const vistoria = await db.vistorias.findById(vistoriaId);
    const user = await db.users.findById(vistoria.user_id);
    
    await this.sendPushNotification(
      user.id,
      'Nova Vistoria Criada',
      `Vistoria ${vistoria.numero} foi criada com sucesso`,
      { vistoriaId, action: 'view_vistoria' }
    );
    
    // Email para empresa se necessário
    if (user.role === 'inspetor') {
      const empresa = await db.empresas.findById(vistoria.empresa_id);
      if (empresa.email) {
        await this.sendEmail(
          empresa.email,
          'Nova Vistoria Criada',
          `<h2>Nova Vistoria Criada</h2>
           <p>O inspetor ${user.nome} criou uma nova vistoria:</p>
           <ul>
             <li><strong>Número:</strong> ${vistoria.numero}</li>
             <li><strong>Tipo:</strong> ${vistoria.tipo}</li>
             <li><strong>Endereço:</strong> ${vistoria.endereco.logradouro}, ${vistoria.endereco.numero}</li>
             <li><strong>Agendamento:</strong> ${vistoria.agendamento ? new Date(vistoria.agendamento).toLocaleString('pt-BR') : 'Não agendada'}</li>
           </ul>`
        );
      }
    }
  }
  
  async notifyVistoriaStatusChange(vistoriaId, oldStatus, newStatus) {
    const vistoria = await db.vistorias.findById(vistoriaId);
    const user = await db.users.findById(vistoria.user_id);
    
    const statusMessages = {
      'em_andamento': 'Vistoria iniciada',
      'concluida': 'Vistoria concluída',
      'cancelada': 'Vistoria cancelada'
    };
    
    if (statusMessages[newStatus]) {
      await this.sendPushNotification(
        user.id,
        'Status da Vistoria Atualizado',
        `${statusMessages[newStatus]}: ${vistoria.numero}`,
        { vistoriaId, status: newStatus }
      );
    }
  }
}

export default new NotificationService();
```

## 5. Fase 4: Módulo de Assinatura Digital (3 dias)

### 5.1 Dia 1: Configuração DocuSign

**Serviço DocuSign:**
```typescript
// src/services/docusignService.js
import docusign from 'docusign-esign';
import fs from 'fs';
import path from 'path';

class DocuSignService {
  constructor() {
    this.apiClient = new docusign.ApiClient();
    this.apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);
    
    // Configurar autenticação JWT
    this.apiClient.configureJWTAuthorizationFlow(
      process.env.DOCUSIGN_INTEGRATION_KEY,
      process.env.DOCUSIGN_USER_ID,
      process.env.DOCUSIGN_BASE_PATH,
      fs.readFileSync(process.env.DOCUSIGN_PRIVATE_KEY_PATH),
      3600 // 1 hora
    );
  }
  
  async authenticate() {
    try {
      const results = await this.apiClient.requestJWTUserToken(
        process.env.DOCUSIGN_INTEGRATION_KEY,
        process.env.DOCUSIGN_USER_ID,
        process.env.DOCUSIGN_BASE_PATH,
        fs.readFileSync(process.env.DOCUSIGN_PRIVATE_KEY_PATH),
        3600
      );
      
      this.apiClient.addDefaultHeader('Authorization', `Bearer ${results.body.access_token}`);
      return results.body.access_token;
    } catch (error) {
      console.error('Erro na autenticação DocuSign:', error);
      throw error;
    }
  }
  
  async createEnvelope(laudoId, signatarios, documentPath) {
    await this.authenticate();
    
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    
    // Ler documento PDF
    const documentBase64 = fs.readFileSync(documentPath, { encoding: 'base64' });
    
    // Criar documento
    const document = docusign.Document.constructFromObject({
      documentBase64,
      name: `Laudo_${laudoId}.pdf`,
      fileExtension: 'pdf',
      documentId: '1'
    });
    
    // Criar signatários
    const signers = signatarios.map((signatario, index) => {
      const signer = docusign.Signer.constructFromObject({
        email: signatario.email,
        name: signatario.nome,
        recipientId: (index + 1).toString(),
        routingOrder: signatario.ordem || (index + 1).toString()
      });
      
      // Adicionar tabs de assinatura
      const signHere = docusign.SignHere.constructFromObject({
        documentId: '1',
        pageNumber: '1',
        recipientId: (index + 1).toString(),
        tabLabel: 'SignHereTab',
        xPosition: '200',
        yPosition: '700'
      });
      
      const dateSigned = docusign.DateSigned.constructFromObject({
        documentId: '1',
        pageNumber: '1',
        recipientId: (index + 1).toString(),
        tabLabel: 'DateSignedTab',
        xPosition: '200',
        yPosition: '750'
      });
      
      signer.tabs = docusign.Tabs.constructFromObject({
        signHereTabs: [signHere],
        dateSignedTabs: [dateSigned]
      });
      
      return signer;
    });
    
    // Criar envelope
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
      emailSubject: `Assinatura de Laudo - ${laudoId}`,
      documents: [document],
      recipients: docusign.Recipients.constructFromObject({
        signers
      }),
      status: 'sent'
    });
    
    try {
      const results = await envelopesApi.createEnvelope(accountId, {
        envelopeDefinition
      });
      
      return {
        envelopeId: results.envelopeId,
        status: results.status,
        statusDateTime: results.statusDateTime
      };
    } catch (error) {
      console.error('Erro ao criar envelope DocuSign:', error);
      throw error;
    }
  }
  
  async getSigningUrls(envelopeId, signatarios) {
    await this.authenticate();
    
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    
    const signingUrls = [];
    
    for (let i = 0; i < signatarios.length; i++) {
      const recipientViewRequest = docusign.RecipientViewRequest.constructFromObject({
        authenticationMethod: 'none',
        email: signatarios[i].email,
        userName: signatarios[i].nome,
        recipientId: (i + 1).toString(),
        returnUrl: `${process.env.APP_URL}/assinatura/callback?envelopeId=${envelopeId}&recipientId=${i + 1}`
      });
      
      try {
        const results = await envelopesApi.createRecipientView(accountId, envelopeId, {
          recipientViewRequest
        });
        
        signingUrls.push({
          signatario: signatarios[i].email,
          url: results.url
        });
      } catch (error) {
        console.error(`Erro ao obter URL de assinatura para ${signatarios[i].email}:`, error);
      }
    }
    
    return signingUrls;
  }
  
  async getEnvelopeStatus(envelopeId) {
    await this.authenticate();
    
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    
    try {
      const results = await envelopesApi.getEnvelope(accountId, envelopeId);
      return {
        status: results.status,
        statusDateTime: results.statusDateTime,
        completedDateTime: results.completedDateTime
      };
    } catch (error) {
      console.error('Erro ao obter status do envelope:', error);
      throw error;
    }
  }
  
  async downloadSignedDocument(envelopeId, documentId = '1') {
    await this.authenticate();
    
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    
    try {
      const results = await envelopesApi.getDocument(accountId, envelopeId, documentId);
      return results;
    } catch (error) {
      console.error('Erro ao baixar documento assinado:', error);
      throw error;
    }
  }
}

export default new DocuSignService();
```

### 5.2 Dia 2: API de Assinatura

**Endpoints de assinatura:**
```typescript
// src/routes/assinaturas.js
app.post('/api/assinaturas/docusign', 
  authMiddleware,
  checkPermission('request_signature'),
  async (req, res) => {
    try {
      const { laudoId, signatarios, configuracoes } = req.body;
      
      // Validar dados
      if (!laudoId || !signatarios || signatarios.length === 0) {
        return res.status(400).json({
          error: 'laudoId e signatarios são obrigatórios'
        });
      }
      
      // Buscar laudo
      const laudo = await db.laudos.findById(laudoId);
      if (!laudo) {
        return res.status(404).json({ error: 'Laudo não encontrado' });
      }
      
      if (!laudo.pdf_url) {
        return res.status(400).json({ error: 'Laudo deve estar em PDF para assinatura' });
      }
      
      // Criar envelope no DocuSign
      const envelope = await docusignService.createEnvelope(
        laudoId,
        signatarios,
        laudo.pdf_url
      );
      
      // Obter URLs de assinatura
      const signingUrls = await docusignService.getSigningUrls(
        envelope.envelopeId,
        signatarios
      );
      
      // Salvar assinaturas no banco
      const assinaturasCriadas = [];
      for (let i = 0; i < signatarios.length; i++) {
        const assinatura = await db.assinaturas.create({
          laudo_id: laudoId,
          signatario_email: signatarios[i].email,
          signatario_nome: signatarios[i].nome,
          ordem: signatarios[i].ordem || (i + 1),
          docusign_envelope_id: envelope.envelopeId,
          docusign_recipient_id: (i + 1).toString(),
          status: 'enviado',
          signing_url: signingUrls[i]?.url
        });
        assinaturasCriadas.push(assinatura);
      }
      
      // Atualizar status do laudo
      await db.laudos.update(laudoId, {
        status: 'aguardando_assinatura'
      });
      
      // Enviar notificações
      for (const signatario of signatarios) {
        await notificationService.sendEmail(
          signatario.email,
          'Documento para Assinatura Digital',
          `<h2>Documento para Assinatura</h2>
           <p>Você foi convidado para assinar digitalmente um laudo de vistoria.</p>
           <p><a href="${signingUrls.find(s => s.signatario === signatario.email)?.url}" 
              style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Assinar Documento
           </a></p>`
        );
      }
      
      res.json({
        success: true,
        envelopeId: envelope.envelopeId,
        status: envelope.status,
        assinaturas: assinaturasCriadas,
        signingUrls
      });
      
    } catch (error) {
      console.error('Erro ao iniciar processo de assinatura:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// Webhook para receber atualizações do DocuSign
app.post('/api/assinaturas/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'envelope-completed') {
      const envelopeId = data.envelopeId;
      
      // Buscar assinaturas relacionadas
      const assinaturas = await db.assinaturas.findByEnvelopeId(envelopeId);
      
      for (const assinatura of assinaturas) {
        await db.assinaturas.update(assinatura.id, {
          status: 'assinado',
          signed_at: new Date(),
          ip_address: data.ipAddress
        });
      }
      
      // Atualizar status do laudo
      const laudo = await db.laudos.findById(assinaturas[0].laudo_id);
      await db.laudos.update(laudo.id, {
        status: 'assinado',
        signed_at: new Date()
      });
      
      // Baixar documento assinado
      const signedDocument = await docusignService.downloadSignedDocument(envelopeId);
      const signedPath = `laudos/signed/${laudo.id}_signed.pdf`;
      fs.writeFileSync(signedPath, signedDocument);
      
      // Atualizar URL do documento assinado
      await db.laudos.update(laudo.id, {
        pdf_url: signedPath
      });
      
      // Sincronizar com Google Drive
      await syncQueue.add('sync-signed-document', {
        laudoId: laudo.id,
        filePath: signedPath
      });
      
      // Notificar usuários
      const vistoria = await db.vistorias.findById(laudo.vistoria_id);
      const user = await db.users.findById(vistoria.user_id);
      
      await notificationService.sendPushNotification(
        user.id,
        'Documento Assinado',
        `O laudo da vistoria ${vistoria.numero} foi assinado digitalmente`,
        { laudoId: laudo.id, vistoriaId: vistoria.id }
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro no webhook DocuSign:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Status de assinatura
app.get('/api/assinaturas/:laudoId/status', 
  authMiddleware,
  async (req, res) => {
    try {
      const { laudoId } = req.params;
      
      const assinaturas = await db.assinaturas.findByLaudoId(laudoId);
      const laudo = await db.laudos.findById(laudoId);
      
      if (assinaturas.length > 0) {
        const envelopeStatus = await docusignService.getEnvelopeStatus(
          assinaturas[0].docusign_envelope_id
        );
        
        res.json({
          laudoStatus: laudo.status,
          envelopeStatus: envelopeStatus.status,
          assinaturas: assinaturas.map(a => ({
            signatario: a.signatario_nome,
            email: a.signatario_email,
            status: a.status,
            signedAt: a.signed_at
          }))
        });
      } else {
        res.json({
          laudoStatus: laudo.status,
          assinaturas: []
        });
      }
    } catch (error) {
      console.error('Erro ao obter status de assinatura:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);
```

### 5.3 Dia 3: Interface de Assinatura

**Componente de assinatura (React Native):**
```typescript
// app-mobile/src/components/AssinaturaDigital.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AssinaturaDigitalProps {
  laudoId: string;
  onStatusChange?: (status: string) => void;
}

const AssinaturaDigital: React.FC<AssinaturaDigitalProps> = ({ 
  laudoId, 
  onStatusChange 
}) => {
  const [assinaturas, setAssinaturas] = useState([]);
  const [laudoStatus, setLaudoStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const checkStatus = async () => {
    try {
      const response = await api.get(`/assinaturas/${laudoId}/status`);
      setAssinaturas(response.data.assinaturas);
      setLaudoStatus(response.data.laudoStatus);
      onStatusChange?.(response.data.laudoStatus);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };
  
  const iniciarAssinatura = async () => {
    setIsLoading(true);
    try {
      const signatarios = [
        {
          email: 'cliente@email.com',
          nome: 'Cliente da Vistoria',
          ordem: 1
        },
        {
          email: 'inspetor@grifo.com',
          nome: 'Inspetor Responsável',
          ordem: 2
        }
      ];
      
      const response = await api.post('/assinaturas/docusign', {
        laudoId,
        signatarios,
        configuracoes: {
          lembretes: true,
          prazoAssinatura: 7
        }
      });
      
      Alert.alert(
        'Assinatura Iniciada',
        'O processo de assinatura digital foi iniciado. Os signatários receberão um email com o link para assinar.',
        [{ text: 'OK', onPress: checkStatus }]
      );
      
    } catch (error) {
      console.error('Erro ao iniciar assinatura:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o processo de assinatura');
    } finally {
      setIsLoading(false);
    }
  };
  
  const abrirAssinatura = (url: string) => {
    Linking.openURL(url);
  };
  
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [laudoId]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assinado': return 'checkmark-circle';
      case 'enviado': return 'mail';
      case 'visualizado': return 'eye';
      case 'pendente': return 'time';
      default: return 'help-circle';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assinado': return '#4CAF50';
      case 'enviado': return '#2196F3';
      case 'visualizado': return '#FF9800';
      case 'pendente': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };
  
  return (
    <View className="p-4 bg-white rounded-lg shadow">
      <Text className="text-xl font-bold mb-4">Assinatura Digital</Text>
      
      {laudoStatus === 'gerado' && (
        <TouchableOpacity
          onPress={iniciarAssinatura}
          disabled={isLoading}
          className={`p-4 rounded-lg mb-4 ${
            isLoading ? 'bg-gray-400' : 'bg-blue-500'
          }`}
        >
          <Text className="text-white text-center font-semibold">
            {isLoading ? 'Iniciando...' : 'Iniciar Assinatura Digital'}
          </Text>
        </TouchableOpacity>
      )}
      
      {assinaturas.length > 0 && (
        <View>
          <Text className="text-lg font-semibold mb-3">Status das Assinaturas</Text>
          
          {assinaturas.map((assinatura, index) => (
            <View key={index} className="flex-row items-center p-3 mb-2 bg-gray-50 rounded">
              <Ionicons 
                name={getStatusIcon(assinatura.status)} 
                size={24} 
                color={getStatusColor(assinatura.status)}
              />
              <View className="flex-1 ml-3">
                <Text className="font-semibold">{assinatura.signatario}</Text>
                <Text className="text-sm text-gray-600">{assinatura.email}</Text>
                <Text className="text-sm" style={{ color: getStatusColor(assinatura.status) }}>
                  {assinatura.status.toUpperCase()}
                </Text>
                {assinatura.signedAt && (
                  <Text className="text-xs text-gray-500">
                    Assinado em: {new Date(assinatura.signedAt).toLocaleString('pt-BR')}
                  </Text>
                )}
              </View>
            </View>
          ))}
          
          <TouchableOpacity
            onPress={checkStatus}
            className="p-2 bg-gray-200 rounded mt-2"
          >
            <Text className="text-center text-gray-700">Atualizar Status</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {laudoStatus === 'assinado' && (
        <View className="mt-4 p-3 bg-green-50 rounded border border-green-200">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text className="ml-2 text-green-800 font-semibold">
              Documento Assinado Digitalmente
            </Text>
          </View>
          <Text className="text-green-600 text-sm mt-1">
            O laudo foi assinado por todos os signatários e está pronto para uso.
          </Text>
        </View>
      )}
    </View>
  );
};

export default AssinaturaDigital;
```

## 6. Fase 5: Sistema de Descrições Editáveis (4 dias)

### 6.1 Dia 1: Estrutura de Dados para Descrições

**Modelo de dados expandido:**
```sql
-- Atualizar tabela de descrições
ALTER TABLE descricoes ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES descricao_templates(id);
ALTER TABLE descricoes ADD COLUMN IF NOT EXISTS validado BOOLEAN DEFAULT false;
ALTER TABLE descricoes ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES users(id);
ALTER TABLE descricoes ADD COLUMN IF NOT EXISTS validado_em TIMESTAMP WITH TIME ZONE;

-- Criar tabela de templates de descrição
CREATE TABLE descricao_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(20) NOT NULL,
    tipo_ambiente VARCHAR(50) NOT NULL,
    template JSONB NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir templates padrão
INSERT INTO descricao_templates (categoria, tipo_ambiente, template) VALUES
('teto', 'residencial', '{
  "campos": [
    {"nome": "material", "tipo": "select", "opcoes": ["Laje", "Gesso", "PVC", "Madeira"], "obrigatorio": true},
    {"nome": "estado", "tipo": "select", "opcoes": ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"], "obrigatorio": true},
    {"nome": "cor", "tipo": "text", "obrigatorio": false},
    {"nome": "observacoes", "tipo": "textarea", "obrigatorio": false}
  ],
  "descricao_padrao": "Teto em {material}, estado {estado}"
}'),
('piso', 'residencial', '{
  "campos": [
    {"nome": "material", "tipo": "select", "opcoes": ["Cerâmica", "Porcelanato", "Laminado", "Madeira", "Cimento"], "obrigatorio": true},
    {"nome": "estado", "tipo": "select", "opcoes": ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"], "obrigatorio": true},
    {"nome": "cor", "tipo": "text", "obrigatorio": false},
    {"nome": "observacoes", "tipo": "textarea", "obrigatorio": false}
  ],
  "descricao_padrao": "Piso em {material}, estado {estado}"
}');
```

### 6.2 Dia 2: API de Descrições

**Endpoints para descrições:**
```typescript
// src/routes/descricoes.js
app.get('/api/descricoes/templates/:categoria/:tipoAmbiente', 
  authMiddleware,
  async (req, res) => {
    try {
      const { categoria, tipoAmbiente } = req.params;
      
      const template = await db.descricao_templates.findOne({
        categoria,
        tipo_ambiente: tipoAmbiente,
        ativo: true
      });
      
      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Erro ao buscar template:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

app.put('/api/descricoes/:ambienteId/:categoria', 
  authMiddleware,
  checkPermission('edit_descricoes'),
  async (req, res) => {
    try {
      const { ambienteId, categoria } = req.params;
      const { descricao, detalhes, templateId } = req.body;
      
      // Verificar se o usuário tem permissão para editar este ambiente
      const ambiente = await db.ambientes.findById(ambienteId);
      const vistoria = await db.vistorias.findById(ambiente.vistoria_id);
      
      if (vistoria.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão para editar' });
      }
      
      // Atualizar ou criar descrição
      let descricaoObj = await db.descricoes.findOne({
        ambiente_id: ambienteId,
        categoria
      });
      
      if (descricaoObj) {
        descricaoObj = await db.descricoes.update(descricaoObj.id, {
          descricao,
          detalhes,
          template_id: templateId,
          updated_at: new Date()
        });
      } else {
        descricaoObj = await db.descricoes.create({
          ambiente_id: ambienteId,
          categoria,
          descricao,
          detalhes,
          template_id: templateId
        });
      }
      
      res.json({ success: true, descricao: descricaoObj });
    } catch (error) {
      console.error('Erro ao atualizar descrição:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

app.post('/api/descricoes/:id/validar', 
  authMiddleware,
  checkPermission('validate_descricoes'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { aprovado, observacoes } = req.body;
      
      const descricao = await db.descricoes.update(id, {
        validado: aprovado,
        validado_por: req.user.id,
        validado_em: new Date(),
        detalhes: {
          ...descricao.detalhes,
          validacao: {
            aprovado,
            observacoes,
            validador: req.user.nome
          }
        }
      });
      
      res.json({ success: true, descricao });
    } catch (error) {
      console.error('Erro ao validar descrição:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);
```

### 6.3 Dia 3: Componente de Descrições Editáveis

**Editor de descrições (React Native):**
```typescript
// app-mobile/src/components/DescricaoEditor.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

interface DescricaoEditorProps {
  ambienteId: string;
  categoria: 'teto' | 'piso' | 'paredes' | 'esquadrias' | 'iluminacao' | 'mobiliario' | 'planejados' | 'eletros';
  tipoAmbiente: string;
  descricaoAtual?: any;
  onSave: (descricao: any) => void;
  onCancel: () => void;
}

const DescricaoEditor: React.FC<DescricaoEditorProps> = ({
  ambienteId,
  categoria,
  tipoAmbiente,
  descricaoAtual,
  onSave,
  onCancel
}) => {
  const [template, setTemplate] = useState<any>(null);
  const [valores, setValores] = useState<any>({});
  const [descricaoGerada, setDescricaoGerada] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    carregarTemplate();
  }, [categoria, tipoAmbiente]);

  useEffect(() => {
    if (template && Object.keys(valores).length > 0) {
      gerarDescricao();
    }
  }, [valores, template]);

  const carregarTemplate = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/descricoes/templates/${categoria}/${tipoAmbiente}`);
      setTemplate(response.data);
      
      // Inicializar valores com dados existentes ou valores padrão
      const valoresIniciais = {};
      response.data.template.campos.forEach(campo => {
        if (descricaoAtual?.detalhes?.[campo.nome]) {
          valoresIniciais[campo.nome] = descricaoAtual.detalhes[campo.nome];
        } else {
          valoresIniciais[campo.nome] = campo.tipo === 'select' ? campo.opcoes[0] : '';
        }
      });
      setValores(valoresIniciais);
      
      if (descricaoAtual?.descricao) {
        setDescricaoGerada(descricaoAtual.descricao);
      }
    } catch (error) {
      console.error('Erro ao carregar template:', error);
      Alert.alert('Erro', 'Não foi possível carregar o template de descrição');
    } finally {
      setIsLoading(false);
    }
  };

  const gerarDescricao = () => {
    if (!template) return;
    
    let descricao = template.template.descricao_padrao;
    
    // Substituir placeholders pelos valores
    Object.keys(valores).forEach(campo => {
      const valor = valores[campo];
      if (valor) {
        descricao = descricao.replace(`{${campo}}`, valor);
      }
    });
    
    // Adicionar observações se existirem
    if (valores.observacoes && valores.observacoes.trim()) {
      descricao += `. Observações: ${valores.observacoes}`;
    }
    
    setDescricaoGerada(descricao);
  };

  const salvarDescricao = async () => {
    setIsSaving(true);
    try {
      const dadosDescricao = {
        descricao: descricaoGerada,
        detalhes: valores,
        templateId: template.id
      };
      
      await api.put(`/descricoes/${ambienteId}/${categoria}`, dadosDescricao);
      
      Alert.alert(
        'Sucesso',
        'Descrição salva com sucesso!',
        [{ text: 'OK', onPress: () => onSave(dadosDescricao) }]
      );
    } catch (error) {
      console.error('Erro ao salvar descrição:', error);
      Alert.alert('Erro', 'Não foi possível salvar a descrição');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCampo = (campo: any) => {
    switch (campo.tipo) {
      case 'select':
        return (
          <View key={campo.nome} className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              {campo.nome.charAt(0).toUpperCase() + campo.nome.slice(1)}
              {campo.obrigatorio && <Text className="text-red-500"> *</Text>}
            </Text>
            <View className="border border-gray-300 rounded-lg">
              <Picker
                selectedValue={valores[campo.nome]}
                onValueChange={(value) => setValores(prev => ({ ...prev, [campo.nome]: value }))}
                style={{ height: 50 }}
              >
                {campo.opcoes.map((opcao: string) => (
                  <Picker.Item key={opcao} label={opcao} value={opcao} />
                ))}
              </Picker>
            </View>
          </View>
        );
        
      case 'textarea':
        return (
          <View key={campo.nome} className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              {campo.nome.charAt(0).toUpperCase() + campo.nome.slice(1)}
              {campo.obrigatorio && <Text className="text-red-500"> *</Text>}
            </Text>
            <TextInput
              value={valores[campo.nome] || ''}
              onChangeText={(text) => setValores(prev => ({ ...prev, [campo.nome]: text }))}
              placeholder={`Digite ${campo.nome.toLowerCase()}...`}
              multiline
              numberOfLines={3}
              className="border border-gray-300 rounded-lg p-3 text-base"
              textAlignVertical="top"
            />
          </View>
        );
        
      default: // text
        return (
          <View key={campo.nome} className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              {campo.nome.charAt(0).toUpperCase() + campo.nome.slice(1)}
              {campo.obrigatorio && <Text className="text-red-500"> *</Text>}
            </Text>
            <TextInput
              value={valores[campo.nome] || ''}
              onChangeText={(text) => setValores(prev => ({ ...prev, [campo.nome]: text }))}
              placeholder={`Digite ${campo.nome.toLowerCase()}...`}
              className="border border-gray-300 rounded-lg p-3 text-base"
            />
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Carregando template...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-xl font-bold text-gray-800">
            Editar {categoria.charAt(0).toUpperCase() + categoria.slice(1)}
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {template && (
          <View>
            {template.template.campos.map(renderCampo)}
            
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-2 text-gray-700">
                Descrição Gerada
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <TextInput
                  value={descricaoGerada}
                  onChangeText={setDescricaoGerada}
                  multiline
                  numberOfLines={4}
                  className="text-base text-gray-800"
                  textAlignVertical="top"
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Você pode editar a descrição gerada diretamente
              </Text>
            </View>
            
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={onCancel}
                className="flex-1 p-4 bg-gray-200 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-semibold">
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={salvarDescricao}
                disabled={isSaving}
                className={`flex-1 p-4 rounded-lg ${
                  isSaving ? 'bg-gray-400' : 'bg-blue-500'
                }`}
              >
                <Text className="text-center text-white font-semibold">
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default DescricaoEditor;
```

### 6.4 Dia 4: Integração com Captura de Fotos

**Componente de descrição pós-captura:**
```typescript
// app-mobile/src/screens/FotoCaptura.tsx (atualização)
import DescricaoEditor from '../components/DescricaoEditor';

const FotoCapturaScreen = () => {
  const [showDescricaoEditor, setShowDescricaoEditor] = useState(false);
  const [categoriaAtual, setCategoriaAtual] = useState('');
  const [fotosCapturadas, setFotosCapturadas] = useState([]);
  
  const handleFotoCapturada = async (foto: any, categoria: string) => {
    // Salvar foto
    const fotoSalva = await salvarFoto(foto, categoria);
    setFotosCapturadas(prev => [...prev, fotoSalva]);
    
    // Mostrar editor de descrição
    setCategoriaAtual(categoria);
    setShowDescricaoEditor(true);
  };
  
  const handleDescricaoSalva = (descricao: any) => {
    setShowDescricaoEditor(false);
    // Continuar com próxima categoria ou finalizar
  };
  
  return (
    <View className="flex-1">
      {/* Interface de captura de fotos */}
      
      {showDescricaoEditor && (
        <Modal visible={showDescricaoEditor} animationType="slide">
          <DescricaoEditor
            ambienteId={ambienteAtual.id}
            categoria={categoriaAtual}
            tipoAmbiente={ambienteAtual.tipo}
            onSave={handleDescricaoSalva}
            onCancel={() => setShowDescricaoEditor(false)}
          />
        </Modal>
      )}
    </View>
  );
};
```

## 7. Fase 6: Modelos de Laudo Diversificados (3 dias)

### 7.1 Dia 1: Templates de Laudo

**Estrutura de templates:**
```sql
-- Criar tabela de templates de laudo
CREATE TABLE laudo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    tipo_imovel VARCHAR(50) NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    template_html TEXT NOT NULL,
    template_css TEXT,
    campos_obrigatorios JSONB DEFAULT '[]',
    configuracoes JSONB DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir templates padrão
INSERT INTO laudo_templates (nome, tipo_imovel, template_html, template_css, campos_obrigatorios) VALUES
('Residencial Completo', 'residencial', '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Laudo de Vistoria - {{numero_vistoria}}</title>
    <style>{{css}}</style>
</head>
<body>
    <div class="header">
        <img src="{{logo_empresa}}" alt="Logo" class="logo">
        <div class="titulo">
            <h1>LAUDO DE VISTORIA PREDIAL</h1>
            <h2>{{tipo_vistoria}}</h2>
        </div>
    </div>
    
    <div class="info-geral">
        <h3>INFORMAÇÕES GERAIS</h3>
        <table>
            <tr><td><strong>Número:</strong></td><td>{{numero_vistoria}}</td></tr>
            <tr><td><strong>Data:</strong></td><td>{{data_vistoria}}</td></tr>
            <tr><td><strong>Endereço:</strong></td><td>{{endereco_completo}}</td></tr>
            <tr><td><strong>Solicitante:</strong></td><td>{{nome_solicitante}}</td></tr>
            <tr><td><strong>Inspetor:</strong></td><td>{{nome_inspetor}}</td></tr>
        </table>
    </div>
    
    <div class="ambientes">
        <h3>DESCRIÇÃO DOS AMBIENTES</h3>
        {{#each ambientes}}
        <div class="ambiente">
            <h4>{{nome}}</h4>
            {{#each descricoes}}
            <div class="categoria">
                <h5>{{categoria}}</h5>
                <p>{{descricao}}</p>
                {{#if fotos}}
                <div class="fotos">
                    {{#each fotos}}
                    <img src="{{url}}" alt="{{categoria}}" class="foto">
                    {{/each}}
                </div>
                {{/if}}
            </div>
            {{/each}}
        </div>
        {{/each}}
    </div>
    
    <div class="conclusao">
        <h3>CONCLUSÃO</h3>
        <p>{{conclusao}}</p>
    </div>
    
    <div class="assinaturas">
        <div class="assinatura">
            <div class="linha"></div>
            <p>{{nome_inspetor}}<br>Inspetor Responsável<br>CREA: {{crea_inspetor}}</p>
        </div>
    </div>
</body>
</html>
', '
.header { display: flex; align-items: center; margin-bottom: 30px; }
.logo { height: 80px; margin-right: 20px; }
.titulo h1 { margin: 0; font-size: 24px; }
.titulo h2 { margin: 5px 0 0 0; font-size: 18px; color: #666; }
.info-geral table { width: 100%; border-collapse: collapse; }
.info-geral td { padding: 8px; border: 1px solid #ddd; }
.ambiente { margin-bottom: 30px; page-break-inside: avoid; }
.categoria { margin-bottom: 15px; }
.fotos { display: flex; flex-wrap: wrap; gap: 10px; }
.foto { width: 200px; height: 150px; object-fit: cover; }
.assinatura { text-align: center; margin-top: 50px; }
.linha { border-top: 1px solid #000; width: 300px; margin: 0 auto 10px; }
', '["numero_vistoria", "data_vistoria", "endereco_completo", "nome_solicitante", "nome_inspetor"]');
```

### 7.2 Dia 2: Gerador de Laudos

**Serviço de geração de laudos:**
```typescript
// src/services/laudoGenerator.js
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class LaudoGenerator {
  constructor() {
    this.registerHelpers();
  }
  
  registerHelpers() {
    // Helper para formatação de data
    Handlebars.registerHelper('formatDate', function(date) {
      return new Date(date).toLocaleDateString('pt-BR');
    });
    
    // Helper para formatação de moeda
    Handlebars.registerHelper('formatCurrency', function(value) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    });
    
    // Helper condicional
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
  }
  
  async gerarLaudo(vistoriaId, templateId = null) {
    try {
      // Buscar dados da vistoria
      const vistoria = await this.buscarDadosVistoria(vistoriaId);
      
      // Buscar template
      const template = await this.buscarTemplate(templateId, vistoria.tipo_imovel);
      
      // Compilar template
      const htmlTemplate = Handlebars.compile(template.template_html);
      const cssTemplate = Handlebars.compile(template.template_css || '');
      
      // Preparar dados para o template
      const dadosTemplate = await this.prepararDados(vistoria);
      
      // Gerar HTML
      const html = htmlTemplate({
        ...dadosTemplate,
        css: cssTemplate(dadosTemplate)
      });
      
      // Gerar PDF
      const pdfBuffer = await this.gerarPDF(html);
      
      // Salvar arquivo
      const nomeArquivo = `laudo_${vistoria.numero}_${Date.now()}.pdf`;
      const caminhoArquivo = path.join('uploads/laudos', nomeArquivo);
      
      fs.writeFileSync(caminhoArquivo, pdfBuffer);
      
      // Salvar registro no banco
      const laudo = await db.laudos.create({
        vistoria_id: vistoriaId,
        template_id: template.id,
        numero: this.gerarNumeroLaudo(),
        pdf_url: caminhoArquivo,
        dados_template: dadosTemplate,
        status: 'gerado'
      });
      
      return laudo;
      
    } catch (error) {
      console.error('Erro ao gerar laudo:', error);
      throw error;
    }
  }
  
  async buscarDadosVistoria(vistoriaId) {
    const vistoria = await db.vistorias.findById(vistoriaId, {
      include: [
        'user',
        'empresa',
        'ambientes.descricoes',
        'ambientes.fotos'
      ]
    });
    
    if (!vistoria) {
      throw new Error('Vistoria não encontrada');
    }
    
    return vistoria;
  }
  
  async buscarTemplate(templateId, tipoImovel) {
    let template;
    
    if (templateId) {
      template = await db.laudo_templates.findById(templateId);
    } else {
      // Buscar template padrão para o tipo de imóvel
      template = await db.laudo_templates.findOne({
        tipo_imovel: tipoImovel,
        ativo: true
      });
    }
    
    if (!template) {
      throw new Error('Template não encontrado');
    }
    
    return template;
  }
  
  async prepararDados(vistoria) {
    const dados = {
      // Dados básicos
      numero_vistoria: vistoria.numero,
      data_vistoria: vistoria.data_vistoria,
      tipo_vistoria: vistoria.tipo,
      endereco_completo: `${vistoria.endereco}, ${vistoria.numero} - ${vistoria.bairro}, ${vistoria.cidade}/${vistoria.estado}`,
      
      // Dados do solicitante
      nome_solicitante: vistoria.nome_solicitante,
      email_solicitante: vistoria.email_solicitante,
      telefone_solicitante: vistoria.telefone_solicitante,
      
      // Dados do inspetor
      nome_inspetor: vistoria.user.nome,
      email_inspetor: vistoria.user.email,
      crea_inspetor: vistoria.user.crea,
      
      // Dados da empresa
      nome_empresa: vistoria.empresa.nome,
      logo_empresa: vistoria.empresa.logo_url,
      
      // Ambientes com descrições e fotos
      ambientes: await this.processarAmbientes(vistoria.ambientes),
      
      // Conclusão
      conclusao: vistoria.observacoes || 'Vistoria realizada conforme solicitado.',
      
      // Dados adicionais
      data_geracao: new Date(),
      total_ambientes: vistoria.ambientes.length,
      total_fotos: vistoria.ambientes.reduce((total, amb) => total + amb.fotos.length, 0)
    };
    
    return dados;
  }
  
  async processarAmbientes(ambientes) {
    return ambientes.map(ambiente => ({
      nome: ambiente.nome,
      tipo: ambiente.tipo,
      descricoes: ambiente.descricoes.map(desc => ({
        categoria: desc.categoria,
        descricao: desc.descricao,
        fotos: ambiente.fotos
          .filter(foto => foto.categoria === desc.categoria)
          .map(foto => ({
            url: foto.url,
            categoria: foto.categoria
          }))
      }))
    }));
  }
  
  async gerarPDF(html) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true
      });
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
  
  gerarNumeroLaudo() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    
    return `${ano}${mes}${timestamp}`;
  }
}

module.exports = new LaudoGenerator();
```

### 7.3 Dia 3: Interface de Customização

**Editor de templates (Portal Web):**
```typescript
// portal-web/app/templates/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [templateAtual, setTemplateAtual] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    carregarTemplates();
  }, []);
  
  const carregarTemplates = async () => {
    try {
      const response = await fetch('/api/laudo-templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };
  
  const salvarTemplate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/laudo-templates/${templateAtual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateAtual)
      });
      
      if (response.ok) {
        alert('Template salvo com sucesso!');
        carregarTemplates();
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar template');
    } finally {
      setIsLoading(false);
    }
  };
  
  const gerarPreview = async () => {
    try {
      const response = await fetch('/api/laudo-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_html: templateAtual.template_html,
          template_css: templateAtual.template_css
        })
      });
      
      const html = await response.text();
      setPreviewHtml(html);
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Templates de Laudo</h1>
        <Button onClick={() => setTemplateAtual({ nome: '', tipo_imovel: '', template_html: '', template_css: '' })}>
          Novo Template
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Templates Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map(template => (
                <div
                  key={template.id}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    templateAtual?.id === template.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setTemplateAtual(template)}
                >
                  <div className="font-semibold">{template.nome}</div>
                  <div className="text-sm text-gray-600">{template.tipo_imovel}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Editor */}
        {templateAtual && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Editor de Template</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="config">
                <TabsList>
                  <TabsTrigger value="config">Configurações</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="config" className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nome do Template</label>
                    <Input
                      value={templateAtual.nome}
                      onChange={(e) => setTemplateAtual(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do template"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de Imóvel</label>
                    <Select
                      value={templateAtual.tipo_imovel}
                      onValueChange={(value) => setTemplateAtual(prev => ({ ...prev, tipo_imovel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residencial">Residencial</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                
                <TabsContent value="html">
                  <Textarea
                    value={templateAtual.template_html}
                    onChange={(e) => setTemplateAtual(prev => ({ ...prev, template_html: e.target.value }))}
                    placeholder="HTML do template..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                </TabsContent>
                
                <TabsContent value="css">
                  <Textarea
                    value={templateAtual.template_css}
                    onChange={(e) => setTemplateAtual(prev => ({ ...prev, template_css: e.target.value }))}
                    placeholder="CSS do template..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                </TabsContent>
                
                <TabsContent value="preview">
                  <div className="space-y-4">
                    <Button onClick={gerarPreview}>Gerar Preview</Button>
                    {previewHtml && (
                      <div className="border rounded-lg p-4 bg-white">
                        <iframe
                          srcDoc={previewHtml}
                          className="w-full h-96 border-0"
                          title="Preview do Template"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setTemplateAtual(null)}>
                  Cancelar
                </Button>
                <Button onClick={salvarTemplate} disabled={isLoading}>
                  {isLoading ? 'Salvando...' : 'Salvar Template'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TemplatesPage;
```

## 8. Cronograma Final e Entrega

### 8.1 Resumo do Cronograma (25 dias)

| Fase | Duração | Descrição | Status |
|------|---------|-----------|--------|
| **Fase 1** | 5 dias | Desativação do modo demo e autenticação | 🔄 Em andamento |
| **Fase 2** | 6 dias | Integração Google Drive e sincronização | ⏳ Pendente |
| **Fase 3** | 4 dias | Sistema de vistorias autônomas | ⏳ Pendente |
| **Fase 4** | 3 dias | Módulo de assinatura digital | ⏳ Pendente |
| **Fase 5** | 4 dias | Descrições editáveis de ambientes | ⏳ Pendente |
| **Fase 6** | 3 dias | Modelos de laudo diversificados | ⏳ Pendente |

### 8.2 Checklist de Entrega

**✅ Documentação Técnica:**
- [x] Documento de requisitos de produção
- [x] Arquitetura técnica detalhada
- [x] Plano de implementação completo
- [ ] Documentação de APIs
- [ ] Manual de deploy

**🔄 Desenvolvimento:**
- [ ] Desativação completa do modo demo
- [ ] Sistema de autenticação restaurado
- [ ] Integração Google Drive funcional
- [ ] Vistorias autônomas implementadas
- [ ] Assinatura digital integrada
- [ ] Descrições editáveis funcionais
- [ ] Templates de laudo diversificados

**⏳ Testes e Validação:**
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes de performance
- [ ] Validação de segurança
- [ ] Testes de usabilidade

**📋 Deploy e Produção:**
- [ ] Configuração de ambiente de produção
- [ ] Migração de dados
- [ ] Configuração de backup
- [ ] Monitoramento implementado
- [ ] Documentação de operação

### 8.3 Próximos Passos

1. **Imediato (Hoje):**
   - Iniciar Fase 1: Desativação do modo demo
   - Configurar ambiente de desenvolvimento
   - Revisar e ajustar arquitetura se necessário

2. **Semana 1:**
   - Completar autenticação e segurança
   - Iniciar integração Google Drive
   - Configurar pipelines de CI/CD

3. **Semana 2:**
   - Finalizar sincronização
   - Implementar vistorias autônomas
   - Iniciar módulo de assinatura

4. **Semana 3:**
   - Completar assinatura digital
   - Implementar descrições editáveis
   - Desenvolver templates de laudo

5. **Semana 4:**
   - Testes completos
   - Ajustes finais
   - Preparação para produção

### 8.4 Considerações Finais

Este plano de implementação fornece um roadmap completo para transformar o sistema Grifo do modo de demonstração para um ambiente de produção robusto e completo. Cada fase foi cuidadosamente planejada para minimizar riscos e maximizar a eficiência do desenvolvimento.

**Pontos Críticos de Atenção:**
- Backup completo antes de iniciar as modificações
- Testes extensivos em ambiente de desenvolvimento
- Validação de segurança em cada etapa
- Documentação contínua das alterações
- Monitoramento de performance durante a implementação

O sucesso desta implementação resultará em um sistema de vistorias prediais completo, seguro e escalável, pronto para uso em ambiente de produção com todas as funcionalidades solicitadas.
```