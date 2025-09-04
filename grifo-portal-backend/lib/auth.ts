export type UserClaims = {
  userId: string;
  email?: string | null;
  empresaId?: string | null;
  role?: string | null;
};

export async function getSessionAndClaims() {
  // Supabase removido: devolve sessão nula e sem claims
  return { session: null, claims: null } as const;
}

