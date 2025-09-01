"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Camera, Eye, EyeOff, Monitor, Smartphone, Tablet, Loader2, CheckCircle, XCircle, Upload, User, X } from "lucide-react";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";
import grifoPortalApiService, { User as UserType, UserSession } from "../../../lib/api";
import { toast } from "sonner";

export default function PerfilPage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await grifoPortalApiService.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        toast.error(response.error || 'Erro ao carregar dados do usuário');
        return;
      }
      setFormData({
          name: response.data.name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
        });
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load user data:', error instanceof Error ? error.message : error);
      }
      toast.error('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    try {
      const sessionsData = await grifoPortalApiService.getActiveSessions();
      // Garantir que sessionsData seja sempre um array
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load active sessions:', error instanceof Error ? error.message : error);
      }
      // Em caso de erro, definir como array vazio
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadUserData();
    loadActiveSessions();
  }, [loadUserData, loadActiveSessions]);

  const handleSaveProfile = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Limpar erros se não houver
    setErrors({});
    
    try {
      setSaving(true);
      await grifoPortalApiService.updateProfile(formData);
      await loadUserData(); // Recarrega os dados
      toast.success('Perfil atualizado com sucesso');
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save profile:', error instanceof Error ? error.message : error);
      }
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }, [formData, loadUserData]);

  const handleChangePassword = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    
    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Senha atual é obrigatória';
    }
    
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'Nova senha é obrigatória';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Nova senha deve ter pelo menos 6 caracteres';
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Limpar erros se não houver
    setErrors({});
    
    try {
      setSaving(true);
      await grifoPortalApiService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada com sucesso');
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to change password:', error instanceof Error ? error.message : error);
      }
      toast.error('Erro ao alterar senha');
    } finally {
      setSaving(false);
    }
  }, [passwordData]);

  const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }
    
    try {
      setUploadingAvatar(true);
      await grifoPortalApiService.uploadAvatar(file);
      await loadUserData(); // Recarrega os dados para mostrar o novo avatar
      toast.success('Avatar atualizado com sucesso');
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to upload avatar:', error instanceof Error ? error.message : error);
      }
      toast.error('Erro ao fazer upload do avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }, [loadUserData]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    try {
      await grifoPortalApiService.revokeSession(sessionId);
      setSessions(prevSessions => 
        Array.isArray(prevSessions) ? prevSessions.filter(s => s.id !== sessionId) : []
      );
      toast.success('Sessão revogada com sucesso');
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to revoke session:', error instanceof Error ? error.message : error);
      }
      toast.error('Erro ao revogar sessão');
    }
  }, []);

  const getDeviceIcon = (device: string) => {
    const deviceLower = device.toLowerCase();
    if (deviceLower.includes('mobile') || deviceLower.includes('android') || deviceLower.includes('iphone')) {
      return Smartphone;
    }
    if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
      return Tablet;
    }
    return Monitor;
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Perfil</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Perfil</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus dados de acesso e preferências</p>
        </div>
      </div>

      {/* Dados de perfil */}
      <SectionCard title="Dados de perfil" subtitle="Seu nome, e-mail e avatar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Nome</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background"
                placeholder="Seu nome completo"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">E-mail</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-1">Telefone (opcional)</label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-input bg-background"
                placeholder="(11) 99999-9999"
              />
            </div>
            
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Salvar perfil
                </>
              )}
            </button>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    {user?.name ? getUserInitials(user.name) : 'U'}
                  </span>
                )}
              </div>
              
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90">
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium">Avatar</p>
              <p className="text-xs text-muted-foreground">Clique na câmera para alterar</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Segurança */}
      <SectionCard title="Segurança" subtitle="Alterar senha de acesso">
        <div className="max-w-md space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">Senha atual</label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full h-9 px-3 pr-10 rounded-md border border-input bg-background"
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">Nova senha</label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full h-9 px-3 pr-10 rounded-md border border-input bg-background"
                placeholder="Digite a nova senha"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Confirmar nova senha</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full h-9 px-3 pr-10 rounded-md border border-input bg-background"
                placeholder="Confirme a nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>
          
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="w-full h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Alterando...
              </>
            ) : (
              'Alterar senha'
            )}
          </button>
        </div>
      </SectionCard>

      {/* Sessões ativas */}
      <SectionCard title="Sessões ativas" subtitle="Dispositivos conectados à sua conta">
        {!Array.isArray(sessions) || sessions.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma sessão ativa encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const IconComponent = getDeviceIcon(session.device || 'desktop');
              return (
                <div key={session.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{session.device || 'Dispositivo desconhecido'}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{session.location || 'Localização desconhecida'}</span>
                        <span>•</span>
                        <span>{session.last_active ? new Date(session.last_active).toLocaleString('pt-BR') : 'Nunca'}</span>
                        {session.is_current && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">Sessão atual</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {!session.is_current && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      className="h-8 px-3 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Revogar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
