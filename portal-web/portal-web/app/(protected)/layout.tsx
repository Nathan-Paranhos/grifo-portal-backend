'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import grifoPortalApiService from '@/lib/api';
import MobileNav from '@/components/layout/MobileNav';
import NotificationCenter from '@/components/NotificationCenter';

// Modo de demonstração
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Se estiver em modo demo, pula a verificação de autenticação
    if (DEMO_MODE) {
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        // Primeiro verifica se há token no localStorage
        const token = localStorage.getItem('grifo_token');
        if (!token) {
          setIsAuthenticated(false);
          router.replace('/login');
          return;
        }

        // Depois verifica com a API se o token é válido
        const isValid = await grifoPortalApiService.verifyAuthentication();
        if (!isValid) {
          setIsAuthenticated(false);
          router.replace('/login');
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        // Log apenas em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth verification failed:', error instanceof Error ? error.message : error);
        }
        setIsAuthenticated(false);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Mostrar loading enquanto verifica autenticação
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não autenticado, não renderiza nada (redirecionamento já foi feito)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="hidden md:flex md:flex-col border-r border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 sticky top-0 min-h-screen">
        {/* Brand */}
        <div className="px-4 py-4 flex items-center gap-2 border-b border-border">
          <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 grid place-items-center">
            <img src="/grifo-logo.svg" alt="Grifo Logo" className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Grifo</div>
            <div className="text-[11px] text-muted-foreground">Portal de Vistorias</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm" aria-label="Navegação principal">
          {/* Section: Geral */}
          <div className="px-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Geral</div>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/dashboard" aria-label="Dashboard">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            <span>Dashboard</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/usage" aria-label="Usage e Relatórios">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2V4h-2v13zm4 0h2V9h-2v8z"/></svg>
            <span>Usage</span>
          </a>

          {/* Section: Operação */}
          <div className="px-2 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Operação</div>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/vistorias" aria-label="Vistorias">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4V4zm0 6h16v2H4v-2zm0 6h10v2H4v-2z"/></svg>
            <span>Vistorias</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/solicitacoes" aria-label="Solicitações">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Solicitações</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/imoveis" aria-label="Imóveis">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9H6v-9H3l9-8z"/></svg>
            <span>Imóveis</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/contestoes" aria-label="Contestações">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6h-8l-2-2H3v16h18V6zm-3 10H6v-2h12v2zm0-4H6V10h12v2z"/></svg>
            <span className="flex-1">Contestações</span>
          </a>

          {/* Section: Administração */}
          <div className="px-2 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Administração</div>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/clientes" aria-label="Clientes">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/></svg>
            <span>Clientes</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/usuarios" aria-label="Usuários">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A6.49 6.49 0 0121 17.5V19h-6v-2.5c0-.57-.1-1.1-.28-1.58.41-.06.86-.1 1.28-.1z"/></svg>
            <span>Usuários</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/empresas" aria-label="Empresas">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm10 8h8V9h-8v12zM3 21h8v-6H3v6zM13 7h8V3h-8v4z"/></svg>
            <span>Empresas</span>
          </a>
          <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/perfil" aria-label="Perfil do usuário">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V22h19.2v-2.8c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
            <span>Perfil</span>
          </a>
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Sessão desativada</span>
            <span className="text-muted-foreground/70">v0.1</span>
          </div>
          <div className="mt-2 text-center text-[10px] text-muted-foreground/60">
            Developer by Nathan Silva
          </div>
        </div>
      </aside>
      <main className="bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="flex items-center gap-2 p-3 md:p-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:pt-4">
            {/* Left cluster: brand + divider */}
            <a href="/dashboard" className="flex items-center gap-2" aria-label="Ir para dashboard">
              <span className="inline-grid h-8 w-8 place-items-center rounded-md bg-primary/10 border border-primary/30">
                <img src="/grifo-logo.svg" alt="Grifo Logo" className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <div className="font-semibold tracking-tight">Grifo</div>
                <div className="hidden xs:block text-xs text-muted-foreground">Vistorias Imobiliárias</div>
              </div>
            </a>
            <div className="mx-2 h-6 w-px bg-border hidden md:block" aria-hidden="true"></div>

            {/* Center: search */}
            <div className="relative w-full order-3 md:order-none md:flex-1 md:max-w-xl mt-2 md:mt-0">
              <input
                type="search"
                placeholder="Buscar (clientes, imóveis, protocolos...)"
                aria-label="Buscar no portal"
                className="w-full h-9 md:h-10 pl-9 pr-3 rounded-md border border-input bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <svg aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4a6 6 0 104.472 10.028l4.75 4.75 1.414-1.414-4.75-4.75A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-[10px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5">/</kbd>
                <span>para buscar</span>
              </div>
            </div>

            {/* Right: quick actions */}
            <div className="ml-auto flex items-center gap-2 order-2 md:order-none">
              {/* Mobile nav trigger */}
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-background/60">
                <MobileNav />
                <button className="hidden sm:inline-flex h-9 px-2 rounded-md hover:bg-muted/30" aria-label="Criar novo">
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/></svg>
                    <span className="hidden md:inline">Novo</span>
                  </div>
                </button>
                <button className="h-9 w-9 rounded-md hover:bg-muted/30 grid place-items-center" aria-label="Alternar tema">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 100 18 7 7 0 010-18z"/></svg>
                </button>
                <NotificationCenter />
                <div className="relative">
                  <button className="h-9 w-9 sm:w-auto sm:pl-2 sm:pr-3 rounded-md hover:bg-muted/30 flex items-center gap-2" aria-haspopup="menu" aria-expanded="false" aria-label="Abrir menu do usuário">
                    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-primary border border-primary/30 text-[10px] font-semibold">PG</span>
                    <svg aria-hidden="true" className="hidden sm:block" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                  </button>
                </div>
              </div>
              <button 
                onClick={async () => {
                  try {
                    await grifoPortalApiService.logout();
                    // Usar replace para evitar problemas de navegação
                    router.replace('/login');
                  } catch (error) {
                    // Log apenas em desenvolvimento
                    if (process.env.NODE_ENV === 'development') {
                      console.error('Logout error:', error instanceof Error ? error.message : error);
                    }
                    // Mesmo com erro, redireciona para login
                    router.replace('/login');
                  }
                }}
                className="hidden sm:inline-flex h-9 px-3 rounded-md bg-destructive text-destructive-foreground hover:opacity-90" 
                aria-label="Fazer logout"
              >
                Sair
              </button>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
