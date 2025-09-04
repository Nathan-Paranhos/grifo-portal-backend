const express = require('express');
const { supabase } = require('../../config/supabase');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { AuthenticationError } = require('../../utils/errors');

const router = express.Router();

// Simplified portal login for debugging
router.post(
  '/portal/login/debug',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const startTime = Date.now();

    console.log('DEBUG: Portal login attempt started', { email, startTime });

    try {
      // Step 1: Test Supabase Auth
      console.log('DEBUG: Step 1 - Testing Supabase Auth');
      const authStart = Date.now();
      
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password
        });

      const authEnd = Date.now();
      console.log('DEBUG: Supabase Auth completed', { 
        duration: authEnd - authStart,
        success: !authError,
        userId: authData?.user?.id
      });

      if (authError || !authData.user) {
        console.log('DEBUG: Auth failed', { authError });
        throw new AuthenticationError('Credenciais inválidas');
      }

      // Step 2: Test simple portal_users query (without JOIN)
      console.log('DEBUG: Step 2 - Testing simple portal_users query');
      const queryStart = Date.now();
      
      const { data: portalUser, error: userError } = await supabase
        .from('portal_users')
        .select('id, nome, email, role, permissions, ativo, empresa_id, first_login_completed, auth_user_id')
        .eq('auth_user_id', authData.user.id)
        .eq('ativo', true)
        .single();

      const queryEnd = Date.now();
      console.log('DEBUG: Simple query completed', { 
        duration: queryEnd - queryStart,
        success: !userError,
        userFound: !!portalUser
      });

      if (userError || !portalUser) {
        console.log('DEBUG: User query failed', { 
          userError,
          authUserId: authData.user.id
        });
        throw new AuthenticationError('Usuário não encontrado ou inativo');
      }

      // Step 3: Test separate empresas query
      console.log('DEBUG: Step 3 - Testing separate empresas query');
      const empresaStart = Date.now();
      
      let empresaData = null;
      if (portalUser.empresa_id) {
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas')
          .select('id, nome')
          .eq('id', portalUser.empresa_id)
          .single();
        
        const empresaEnd = Date.now();
        console.log('DEBUG: Empresas query completed', { 
          duration: empresaEnd - empresaStart,
          success: !empresaError,
          empresaFound: !!empresa
        });
        
        empresaData = empresa;
      }

      // Step 4: Test metadata update
      console.log('DEBUG: Step 4 - Testing metadata update');
      const metadataStart = Date.now();
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        authData.user.id,
        {
          app_metadata: {
            ...authData.user.app_metadata,
            user_type: 'portal_user',
            user_id: portalUser.id,
            empresa_id: portalUser.empresa_id,
            role: portalUser.role,
            nome: portalUser.nome,
            permissions: portalUser.permissions || []
          }
        }
      );

      const metadataEnd = Date.now();
      console.log('DEBUG: Metadata update completed', { 
        duration: metadataEnd - metadataStart,
        success: !updateError
      });

      // Step 5: Test last login update
      console.log('DEBUG: Step 5 - Testing last login update');
      const loginUpdateStart = Date.now();
      
      await supabase
        .from('portal_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', portalUser.id);

      const loginUpdateEnd = Date.now();
      console.log('DEBUG: Last login update completed', { 
        duration: loginUpdateEnd - loginUpdateStart
      });

      const totalEnd = Date.now();
      console.log('DEBUG: Total login process completed', { 
        totalDuration: totalEnd - startTime
      });

      res.json({
        success: true,
        message: 'Debug login realizado com sucesso',
        debug: {
          totalDuration: totalEnd - startTime,
          steps: {
            auth: authEnd - authStart,
            userQuery: queryEnd - queryStart,
            empresaQuery: empresaData ? (empresaEnd - empresaStart) : 0,
            metadataUpdate: metadataEnd - metadataStart,
            loginUpdate: loginUpdateEnd - loginUpdateStart
          }
        },
        data: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          user: {
            id: portalUser.id,
            name: portalUser.nome,
            email: portalUser.email,
            role: portalUser.role,
            permissions: portalUser.permissions,
            user_type: 'portal_user',
            company: empresaData ? {
              id: empresaData.id,
              name: empresaData.nome
            } : null
          }
        }
      });

    } catch (error) {
      const errorEnd = Date.now();
      console.log('DEBUG: Login failed', { 
        error: error.message,
        duration: errorEnd - startTime
      });
      throw error;
    }
  })
);

module.exports = router;