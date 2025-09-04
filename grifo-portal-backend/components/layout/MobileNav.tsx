"use client";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const dlgId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      // lock body scroll while menu is open
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Hamburger (mobile only) */}
      <button
        className="md:hidden h-9 w-9 rounded-md border border-border hover:bg-muted/30 grid place-items-center"
        aria-label="Abrir menu de navegação"
        aria-haspopup="dialog"
        aria-controls={dlgId}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
      </button>

      {/* Overlay + Drawer */}
      {open && createPortal(
        <div className="md:hidden fixed inset-0 z-[9999]" aria-hidden={!open}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)}></div>
          <div
            id={dlgId}
            role="dialog"
            aria-modal="true"
            className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] bg-background border-r border-border shadow-2xl p-4 flex flex-col gap-2 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 grid place-items-center text-primary">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 4.5L20 8l-4 3 1 5-5-2.5L7 16l1-5-4-3 5.5-1.5L12 2z"/></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">Grifo</div>
                  <div className="text-[11px] text-muted-foreground">Portal de Vistorias</div>
                </div>
              </div>
              <button
                className="h-8 w-8 rounded-md border border-border hover:bg-muted/30 grid place-items-center"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71L12 12.01 5.7 5.7 4.29 7.11l6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.29 6.3 1.42-1.41-6.3-6.3 6.3-6.3z"/></svg>
              </button>
            </div>

            <nav className="pt-2 text-sm" aria-label="Menu móvel">
              <div className="px-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Geral</div>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/dashboard" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                <span>Dashboard</span>
              </a>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/usage" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2V4h-2v13zm4 0h2V9h-2v8z"/></svg>
                <span>Usage</span>
              </a>

              <div className="px-2 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Operação</div>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/vistorias" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4V4zm0 6h16v2H4v-2zm0 6h10v2H4v-2z"/></svg>
                <span>Vistorias</span>
              </a>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/imoveis" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9H6v-9H3l9-8z"/></svg>
                <span>Imóveis</span>
              </a>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/contestoes" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6h-8l-2-2H3v16h18V6zm-3 10H6v-2h12v2zm0-4H6V10h12v2z"/></svg>
                <span>Contestações</span>
              </a>

              <div className="px-2 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">Administração</div>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/usuarios" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A6.49 6.49 0 0121 17.5V19h-6v-2.5c0-.57-.1-1.1-.28-1.58.41-.06.86-.1 1.28-.1z"/></svg>
                <span>Usuários</span>
              </a>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/empresas" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm10 8h8V9h-8v12zM3 21h8v-6H3v6zM13 7h8V3h-8v4z"/></svg>
                <span>Empresas</span>
              </a>
              <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30" href="/perfil" onClick={() => setOpen(false)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V22h19.2v-2.8c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                <span>Perfil</span>
              </a>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
