import { createClient } from '@supabase/supabase-js';

// Conexão com o banco da programação. As duas variáveis são embutidas no
// site na hora do BUILD (comportamento do Vite), então cadastrá-las na
// hospedagem não basta: é preciso publicar de novo para valerem.
//
// A chave `anon` é pública de propósito — ela identifica o projeto, não
// autoriza nada. Quem protege os dados são as regras de acesso do banco
// (ver supabase/schema.sql), que só liberam leitura e escrita para quem
// está autenticado.
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = supabaseConfigurado
  ? createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const AVISO_SEM_CONFIG =
  'Banco da programação não configurado. Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente da hospedagem (ou no arquivo .env, se estiver rodando local) e publique o site de novo — elas entram no site no momento da publicação.';
