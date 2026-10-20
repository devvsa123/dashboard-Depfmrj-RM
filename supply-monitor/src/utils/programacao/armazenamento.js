import { supabase, supabaseConfigurado } from '../../lib/supabase';

// Única porta entre a programação e o banco. O resto do módulo — motor,
// telas, documento — não sabe que o Supabase existe; se um dia o banco
// mudar, muda só este arquivo.
//
// As escritas são otimistas: a tela atualiza na hora e a gravação segue
// em paralelo. Se falhar, quem chamou recebe o erro e mostra o aviso —
// nunca fica a impressão de que salvou quando não salvou.

const semBanco = () => !supabaseConfigurado;

export const carregarTudo = async () => {
  if (semBanco()) return { demandas: [], bloqueios: [], overrides: {}, config: {} };

  const [d, b, o, c] = await Promise.all([
    supabase.from('demandas').select('*').order('criada_em', { ascending: true }),
    supabase.from('bloqueios').select('*').order('data', { ascending: true }),
    supabase.from('capacidade_overrides').select('*'),
    supabase.from('config').select('*')
  ]);

  const erro = d.error || b.error || o.error || c.error;
  if (erro) throw erro;

  return {
    demandas: (d.data || []).map(linha => ({
      id: linha.id,
      origem: linha.origem,
      referencia: linha.referencia || '',
      prazo: linha.prazo || null,
      diasExpedicao: linha.dias_expedicao,
      rms: linha.rms || [],
      semana: linha.semana || null,
      criadaEm: linha.criada_em,
      criadaPorNome: linha.criada_por_nome || ''
    })),
    bloqueios: (b.data || []).map(linha => ({ data: linha.data, motivo: linha.motivo })),
    overrides: Object.fromEntries((o.data || []).map(linha => [linha.data, linha.rms])),
    config: Object.fromEntries((c.data || []).map(linha => [linha.chave, linha.valor]))
  };
};

export const salvarDemanda = async (d) => {
  if (semBanco()) return;
  const { error } = await supabase.from('demandas').insert({
    id: d.id,
    origem: d.origem,
    referencia: d.referencia || '',
    prazo: d.prazo,
    dias_expedicao: d.diasExpedicao,
    rms: d.rms,
    semana: d.semana,
    criada_por_nome: d.criadaPorNome || ''
  });
  if (error) throw error;
};

export const apagarDemanda = async (id) => {
  if (semBanco()) return;
  const { error } = await supabase.from('demandas').delete().eq('id', id);
  if (error) throw error;
};

export const salvarBloqueio = async ({ data, motivo }) => {
  if (semBanco()) return;
  const { error } = await supabase.from('bloqueios').upsert({ data, motivo }, { onConflict: 'data' });
  if (error) throw error;
};

export const apagarBloqueio = async (data) => {
  if (semBanco()) return;
  const { error } = await supabase.from('bloqueios').delete().eq('data', data);
  if (error) throw error;
};

export const salvarOverride = async (dia, valor) => {
  if (semBanco()) return;
  if (valor === null || valor === undefined || valor === '') {
    const { error } = await supabase.from('capacidade_overrides').delete().eq('data', dia);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('capacidade_overrides')
    .upsert({ data: dia, rms: Number(valor) }, { onConflict: 'data' });
  if (error) throw error;
};

export const salvarConfig = async (chave, valor) => {
  if (semBanco()) return;
  const { error } = await supabase.from('config').upsert({ chave, valor }, { onConflict: 'chave' });
  if (error) throw error;
};

// ── Versões publicadas ───────────────────────────────────────────────
export const carregarVersoes = async (semana) => {
  if (semBanco()) return [];
  const { data, error } = await supabase
    .from('programacoes')
    .select('*')
    .eq('semana', semana)
    .order('versao', { ascending: true });
  if (error) throw error;
  return (data || []).map(linha => ({
    numero: linha.versao,
    publicadaEm: linha.publicada_em,
    por: linha.publicada_por_nome || '',
    snapshot: linha.snapshot
  }));
};

export const salvarVersao = async ({ semana, numero, por, usuarioId, snapshot }) => {
  if (semBanco()) return;
  const { error } = await supabase.from('programacoes').insert({
    semana,
    versao: numero,
    publicada_por: usuarioId || null,
    publicada_por_nome: por || '',
    snapshot
  });
  if (error) throw error;
};

// Apaga a semana inteira — todas as versões publicadas. É o botão de
// desfazer de quem publicou a semana errada; o apagarVersao abaixo
// desfaz só a última publicação.
export const apagarSemana = async (semana) => {
  if (semBanco()) return;
  const { error } = await supabase.from('programacoes').delete().eq('semana', semana);
  if (error) throw error;
};

export const apagarVersao = async (semana, numero) => {
  if (semBanco()) return;
  const { error } = await supabase.from('programacoes').delete().eq('semana', semana).eq('versao', numero);
  if (error) throw error;
};

// ── Cadastro de CAM e rotas ──────────────────────────────────────────
export const carregarCamConfig = async () => {
  if (semBanco()) return [];
  const { data, error } = await supabase.from('cam_config').select('*').order('cam');
  if (error) throw error;
  return (data || []).map(l => ({
    cam: l.cam,
    sigla: l.sigla || '',
    tratamento: l.tratamento,
    documentoEsperado: l.documento_esperado || null,
    diasRota: l.dias_rota || [],
    janelaInicio: l.janela_inicio ?? null,
    janelaFim: l.janela_fim ?? null,
    observacao: l.observacao || '',
    atualizadoEm: l.atualizado_em,
    atualizadoPor: l.atualizado_por || ''
  }));
};

export const salvarCamConfig = async (c, porNome) => {
  if (semBanco()) return;
  const { error } = await supabase.from('cam_config').upsert({
    cam: c.cam,
    sigla: c.sigla || '',
    tratamento: c.tratamento,
    documento_esperado: c.documentoEsperado,
    dias_rota: c.diasRota || [],
    janela_inicio: c.janelaInicio,
    janela_fim: c.janelaFim,
    observacao: c.observacao || '',
    atualizado_em: new Date().toISOString(),
    atualizado_por: porNome || ''
  }, { onConflict: 'cam' });
  if (error) throw error;
};
