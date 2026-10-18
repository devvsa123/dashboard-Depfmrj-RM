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
  'Cadastre as duas variáveis nas variáveis de ambiente da hospedagem (ou no arquivo .env, se estiver rodando local) e publique o site de novo — elas entram no site no momento da publicação, não em tempo de execução.';

// Diagnóstico de qual variável faltou. Saber se faltou uma ou as duas
// separa na hora erro de digitação no nome, variável cadastrada só em um
// ambiente, e site publicado antes do cadastro. O endereço do projeto não
// é segredo (vai no site de qualquer forma); a chave nunca é exibida.
export const diagnosticoConfig = () => ([
  { nome: 'VITE_SUPABASE_URL', presente: Boolean(url), valor: url || null },
  { nome: 'VITE_SUPABASE_ANON_KEY', presente: Boolean(chave), valor: chave ? `${String(chave).slice(0, 12)}… (${String(chave).length} caracteres)` : null }
]);
