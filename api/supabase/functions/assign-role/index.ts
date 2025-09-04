import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { withAuth } from '../_shared/auth.ts';
import { assignRoleSchema } from '../_shared/validation.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('assign-role');

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    return await withAuth(req, async (req, supabase, user) => {
      logger.info('Assigning role', { userId: user.id, userRole: user.role });

    // Parse and validate request body
    const body = await req.json();
    const validation = assignRoleSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Invalid request body', { errors: validation.error.errors });
      return createErrorResponse('Invalid request data', 400);
    }

    const { user_id, role, empresa_id } = validation.data;



    // Check if empresa exists
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome, ativa')
      .eq('id', empresa_id)
      .single();

    if (empresaError) {
      logger.error('Error checking empresa', empresaError, { empresa_id });
      return createErrorResponse('Empresa not found', 404);
    }

    if (!empresa.ativa) {
      logger.warn('Empresa is inactive', { empresa_id });
      return createErrorResponse('Empresa is inactive', 400);
    }

    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
    
    if (authError || !authUser.user) {
      logger.error('User not found in auth', authError, { user_id });
      return createErrorResponse('User not found', 404);
    }

    // Update or insert user in usuarios table
    const { data: existingUser, error: checkUserError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', user_id)
      .single();

    let userData;
    
    if (checkUserError && checkUserError.code === 'PGRST116') {
      // User doesn't exist, create new record
      const { data: newUser, error: insertError } = await supabase
        .from('usuarios')
        .insert({
          id: user_id,
          email: authUser.user.email!,
          nome: authUser.user.user_metadata?.full_name || authUser.user.email!,
          role,
          empresa_id
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Error creating user', insertError);
        return createErrorResponse('Failed to create user', 500);
      }

      userData = newUser;
      logger.info('User created', { user_id, role, empresa_id });
    } else if (!checkUserError) {
      // User exists, update role and empresa_id
      const { data: updatedUser, error: updateError } = await supabase
        .from('usuarios')
        .update({ role, empresa_id })
        .eq('id', user_id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating user', updateError);
        return createErrorResponse('Failed to update user', 500);
      }

      userData = updatedUser;
      logger.info('User role updated', { user_id, role, empresa_id });
    } else {
      logger.error('Error checking user', checkUserError);
      return createErrorResponse('Database error', 500);
    }

    // Update user metadata in auth.users for JWT claims
    const { error: metadataError } = await supabase.auth.admin.updateUserById(
      user_id,
      {
        user_metadata: {
          ...authUser.user.user_metadata,
          role,
          empresa_id
        }
      }
    );

    if (metadataError) {
      logger.error('Error updating user metadata', metadataError);
      // Don't fail the request, just log the error
    }

    logger.info('Role assigned successfully', { 
      user_id, 
      role, 
      empresa_id,
      empresa_nome: empresa.nome
    });

    return createSuccessResponse({
      user: {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        role: userData.role,
        empresa_id: userData.empresa_id,
        created_at: userData.created_at,
        updated_at: userData.updated_at
      },
      empresa: {
        id: empresa.id,
        nome: empresa.nome
      }
    });
    }, ['superadmin']);

  } catch (error) {
    logger.error('Unexpected error in assign-role', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});