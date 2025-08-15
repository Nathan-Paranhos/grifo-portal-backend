"use client";
import { useState } from "react";
import SectionCard from "../../../components/ui/SectionCard";
import Tooltip from "../../../components/ui/Tooltip";

export default function PerfilPage() {
  // Simulação de papel do usuário atual
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [nome, setNome] = useState("Pedro Grifo");
  const [email, setEmail] = useState("pedro@grifo.com");
  const [avatar, setAvatar] = useState<string | null>(null);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");

  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  function showToast(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2200);
  }

  function salvarPerfil() {
    if (!nome.trim()) return showToast("Informe seu nome", "error");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return showToast("E-mail inválido", "error");
    showToast("Perfil atualizado com sucesso");
  }

  function resetarSenha() {
    if (!senhaAtual || !senhaNova || !senhaConf) return showToast("Preencha todos os campos", "error");
    if (senhaNova.length < 6) return showToast("Senha nova muito curta", "error");
    if (senhaNova !== senhaConf) return showToast("Confirmação não confere", "error");
    showToast("Senha alterada com sucesso");
    setSenhaAtual("");
    setSenhaNova("");
    setSenhaConf("");
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        <ol className="flex items-center gap-1">
          <li><a href="/dashboard" className="hover:underline">Início</a></li>
          <li aria-hidden className="mx-1">/</li>
          <li aria-current="page" className="text-foreground">Meu Perfil</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus dados de acesso e preferências (UI-only).</p>
        </div>
        <Tooltip content="Simulação local do papel do usuário">
          <button
            onClick={() => setIsSuperAdmin((v) => !v)}
            className="h-9 rounded-md border border-border px-3 text-xs hover:bg-muted/30"
          >
            {isSuperAdmin ? "Simulando: SuperAdmin" : "Simulando: Usuário comum"}
          </button>
        </Tooltip>
      </div>

      {!isSuperAdmin && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
          Acesso de leitura: apenas SuperAdmin pode alterar dados de perfil e ver sessões ativas.
        </div>
      )}

      {/* Dados de Perfil */}
      <SectionCard title="Dados de perfil" subtitle="Seu nome, e-mail e avatar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={!isSuperAdmin}
                className={`mt-1 h-9 w-full px-3 rounded-md border border-input bg-background ${!isSuperAdmin ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isSuperAdmin}
                className={`mt-1 h-9 w-full px-3 rounded-md border border-input bg-background ${!isSuperAdmin ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="flex justify-end">
              <Tooltip content={isSuperAdmin ? "Salvar alterações no perfil" : "Somente SuperAdmin pode salvar"}>
                <button
                  onClick={salvarPerfil}
                  disabled={!isSuperAdmin}
                  className={`h-9 rounded-md border border-border px-3 text-sm ${isSuperAdmin ? "hover:bg-muted/30" : "opacity-60 cursor-not-allowed"}`}
                >
                  Salvar perfil
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-amber-500/40 to-amber-300/20 border border-border grid place-items-center text-amber-200">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="text-lg font-semibold">PG</span>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Avatar</p>
              <Tooltip content={isSuperAdmin ? "Apenas visual, sem upload real" : "Somente SuperAdmin"}>
                <button
                  onClick={() => setAvatar(avatar ? null : "https://picsum.photos/96")}
                  disabled={!isSuperAdmin}
                  className={`h-8 rounded-md border border-border px-2 text-xs ${isSuperAdmin ? "hover:bg-muted/30" : "opacity-60 cursor-not-allowed"}`}
                >
                  {avatar ? "Remover" : "Alterar avatar"}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Segurança */}
      <SectionCard title="Segurança" subtitle="Atualize sua senha periodicamente">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Senha atual</label>
            <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} disabled={!isSuperAdmin} className={`mt-1 h-9 w-full px-3 rounded-md border border-input bg-background ${!isSuperAdmin ? "opacity-70 cursor-not-allowed" : ""}`} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Nova senha</label>
              <Tooltip content="Mín. 6 caracteres"><span className="text-[10px] text-muted-foreground">requisito</span></Tooltip>
            </div>
            <input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} disabled={!isSuperAdmin} className={`mt-1 h-9 w-full px-3 rounded-md border border-input bg-background ${!isSuperAdmin ? "opacity-70 cursor-not-allowed" : ""}`} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Confirmar nova senha</label>
            <input type="password" value={senhaConf} onChange={(e) => setSenhaConf(e.target.value)} disabled={!isSuperAdmin} className={`mt-1 h-9 w-full px-3 rounded-md border border-input bg-background ${!isSuperAdmin ? "opacity-70 cursor-not-allowed" : ""}`} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Tooltip content={isSuperAdmin ? "Aplicar nova senha" : "Somente SuperAdmin"}>
            <button onClick={resetarSenha} disabled={!isSuperAdmin} className={`h-9 rounded-md border border-border px-3 text-sm ${isSuperAdmin ? "hover:bg-muted/30" : "opacity-60 cursor-not-allowed"}`}>Atualizar senha</button>
          </Tooltip>
        </div>
      </SectionCard>

      {/* Sessões ativas (apenas SuperAdmin) */}
      {isSuperAdmin && (
        <SectionCard title="Sessões ativas" subtitle="Usuários atualmente logados">
          <div className="overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-card/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/70">
                <tr>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Usuário</th>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Papel</th>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Empresa</th>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nome: "Ana Souza", papel: "gestor", empresa: "Grifo Imóveis", ultimo: "há 2 min" },
                  { nome: "Bruno Lima", papel: "vistoriador", empresa: "Alpha Realty", ultimo: "há 5 min" },
                  { nome: "Você (Pedro)", papel: "superadmin", empresa: "Grifo", ultimo: "agora" },
                ].map((s, i) => (
                  <tr key={i} className="border-t border-border odd:bg-background even:bg-muted/5">
                    <td className="px-3 py-2">{s.nome}</td>
                    <td className="px-3 py-2 capitalize">{s.papel}</td>
                    <td className="px-3 py-2">{s.empresa}</td>
                    <td className="px-3 py-2">{s.ultimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-md px-3 py-2 text-sm shadow-md border ${toast.tone === "success" ? "bg-emerald-600 text-white border-emerald-500" : "bg-rose-600 text-white border-rose-500"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
