// Declarações de tipos para Deno
declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  
  const env: Env;
}

// Headers interface extension
interface Headers {
  entries(): IterableIterator<[string, string]>;
}

// Deno HTTP server types
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

// Supabase types
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export { createClient, SupabaseClient } from '@supabase/supabase-js';
  export * from '@supabase/supabase-js';
}

declare module '@supabase/supabase-js' {
  export interface SupabaseClient {
    auth: any;
    from: (table: string) => any;
    rpc: (fn: string, params?: any) => any;
    storage: any;
  }
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

// Zod types
declare module 'https://deno.land/x/zod@v3.16.1/mod.ts' {
  export * from 'zod';
}