import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('drive-sync');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Webhook payload do Storage
    const payload = await req.json();
    console.log('Storage webhook payload:', payload);

    // Verificar se é um arquivo PDF
    if (!payload.Key || !payload.Key.endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ message: 'Não é um arquivo PDF, ignorando' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair informações do caminho
    const pathParts = payload.Key.split('/');
    if (pathParts.length < 3) {
      throw new Error('Formato de caminho inválido');
    }

    const empresaId = pathParts[1];
    const vistoriaId = pathParts[2];

    // Buscar dados da empresa para configurações do Drive
    const { data: empresa, error: empresaError } = await supabaseClient
      .from('empresas')
      .select('nome, configuracoes')
      .eq('id', empresaId)
      .single();

    if (empresaError || !empresa) {
      throw new Error('Empresa não encontrada');
    }

    // Check if Google Drive integration is enabled
    const googleServiceAccount = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const googleDriveFolderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!googleServiceAccount || !googleDriveFolderId) {
      logger.warn('Google Drive integration not configured');
      return createSuccessResponse({ message: 'Google Drive integration not configured' });
    }

    // Download the PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('pdfs')
      .download(payload.Key);

    if (downloadError || !fileData) {
      logger.error('Error downloading file from storage', downloadError instanceof Error ? downloadError : new Error(String(downloadError)), { key: payload.Key });
      return createErrorResponse('Failed to download file', 500);
    }

    // Convert to ArrayBuffer for Google Drive upload
    const arrayBuffer = await fileData.arrayBuffer();

    // Upload to Google Drive
    const driveUrl = await uploadToGoogleDrive({
      fileName: `${empresa.nome}_${vistoriaId}_${Date.now()}.pdf`,
      fileData: arrayBuffer,
      empresaNome: empresa.nome,
      empresaId,
      vistoriaId
    });

    if (!driveUrl) {
      logger.error('Failed to upload file to Google Drive', new Error('Upload failed'), { fileName: payload.Key });
      return createErrorResponse('Failed to upload to Google Drive', 500);
    }

    // Optionally, store the Google Drive link in the database
    try {
      const { error: updateError } = await supabaseClient
        .from('vistorias')
        .update({
          drive_url: driveUrl
        })
        .eq('id', vistoriaId);

      if (updateError) {
        logger.warn('Failed to update vistoria with Google Drive link', { 
          error: updateError, 
          vistoriaId 
        });
      }
    } catch (error) {
      logger.warn('Error updating vistoria with Google Drive link', { error: error instanceof Error ? error.message : String(error) });
    }

    logger.info('File successfully synced to Google Drive', {
      empresaId,
      vistoriaId,
      fileName: payload.Key,
      driveUrl
    });

    return createSuccessResponse({
      message: 'File synced to Google Drive successfully',
      drive_url: driveUrl
    });

  } catch (error) {
    logger.error('Unexpected error in drive-sync', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});

async function uploadToGoogleDrive(params: {
  fileName: string;
  fileData: ArrayBuffer;
  empresaNome: string;
  empresaId: string;
  vistoriaId: string;
}): Promise<string> {
  const { fileName, fileData, empresaNome, empresaId } = params;

  // Configurações do Google Drive API
  const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const GOOGLE_PRIVATE_KEY = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

  if (!GOOGLE_DRIVE_API_KEY || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Configurações do Google Drive não encontradas');
  }

  try {
    // Gerar JWT para autenticação
    const jwt = await generateJWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    // Obter access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Criar ou encontrar pasta da empresa
    const folderId = await createOrFindFolder(accessToken, empresaNome);

    // Upload do arquivo
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileData], { type: 'application/pdf' }));

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });

    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      throw new Error(`Erro no upload: ${uploadData.error?.message || 'Erro desconhecido'}`);
    }

    // Retornar URL do arquivo
    return `https://drive.google.com/file/d/${uploadData.id}/view`;

  } catch (error) {
    console.error('Erro no upload para Google Drive:', error);
    throw error;
  }
}

async function generateJWT(params: {
  email: string;
  privateKey: string;
  scopes: string[];
}): Promise<string> {
  // Implementação simplificada do JWT
  // Em produção, usar uma biblioteca JWT adequada
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: params.email,
    scope: params.scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Simulação - em produção usar crypto adequado
  return btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload)) + '.signature';
}

async function createOrFindFolder(accessToken: string, folderName: string): Promise<string> {
  // Buscar pasta existente
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const searchData = await searchResponse.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Criar nova pasta
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  const createData = await createResponse.json();
  return createData.id;
}