import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigurado } from '../lib/supabase';

// Mensagens do Supabase vêm em inglês e técnicas demais para quem só quer
// entrar no sistema.
const TRADUCOES = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Este usuário ainda não confirmou o e-mail.'],
  [/too many requests|rate limit/i, 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'],
  [/failed to fetch|network/i, 'Não foi possível falar com o servidor. Verifique a conexão.']
];

const traduzir = (mensagem) => {
  const texto = String(mensagem || '');
  const achado = TRADUCOES.find(([re]) => re.test(texto));
  return achado ? achado[1] : (texto || 'Não foi possível entrar.');
};

export const useAuth = () => {
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSessao(data.session);
      setCarregando(false);
    });

    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova);
    });
    return () => { vivo = false; inscricao.subscription.unsubscribe(); };
  }, []);

  const entrar = useCallback(async (email, senha) => {
    if (!supabaseConfigurado) return { erro: 'Banco não configurado.' };
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      const msg = traduzir(error.message);
      setErro(msg);
      return { erro: msg };
    }
    return { ok: true };
  }, []);

  const sair = useCallback(async () => {
    if (!supabaseConfigurado) return;
    await supabase.auth.signOut();
  }, []);

  // O nome que aparece no documento e no "quem publicou". Vem do perfil do
  // usuário se estiver preenchido; senão, do e-mail.
  const usuario = sessao?.user || null;
  const nome = usuario
    ? (usuario.user_metadata?.nome || usuario.user_metadata?.full_name || usuario.email?.split('@')[0] || '')
    : '';

  return { sessao, usuario, nome, autenticado: Boolean(sessao), carregando, erro, setErro, entrar, sair };
};
