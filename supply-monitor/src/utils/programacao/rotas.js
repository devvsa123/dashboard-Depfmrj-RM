import { somaDias, diaDaSemana, DIAS_CURTOS, isoParaPartes, hojeIso } from './semana';

// Cadastro de CAM e rotas: quem entrega cada cliente e quando.
//
// Duas coisas que parecem uma só, e não são:
//   tratamento — quem leva o material até o cliente. GTC somos nós, em
//                dia fixo da semana; STC é terceiro (CDAM ou
//                transportadora), que retira numa janela do mês.
//   documento  — o que é lançado no WMS. Quase sempre acompanha o
//                tratamento, mas não sempre: a entrega a empresas do
//                Núcleo de Implantação é retirada por terceiro e mesmo
//                assim o documento lançado é GTC.
//
// Quem manda na fila da Expedição é o TRATAMENTO. O documento esperado
// serve só para apontar divergência com o que aparece no WMS.

export const TRATAMENTOS = {
  GTC: 'GTC',
  STC: 'STC',
  OCULTO: 'OCULTO',
  PENDENTE: 'PENDENTE'
};

export const TRATAMENTO_INFO = {
  GTC: { label: 'GTC — nós entregamos', curto: 'GTC', descricao: 'Entrega feita pelo depósito, em dia fixo da semana', tom: 'emerald' },
  STC: { label: 'STC — terceiro retira', curto: 'STC', descricao: 'Retirada por CDAM ou transportadora, em janela do mês', tom: 'indigo' },
  OCULTO: { label: 'Oculto', curto: '—', descricao: 'CAM que existe na base mas não é mais usado', tom: 'slate' },
  PENDENTE: { label: 'Não cadastrado', curto: '?', descricao: 'Ainda sem definição de rota', tom: 'amber' }
};

export const DIAS_UTEIS = [
  { n: 1, label: 'Segunda', curto: 'Seg' },
  { n: 2, label: 'Terça', curto: 'Ter' },
  { n: 3, label: 'Quarta', curto: 'Qua' },
  { n: 4, label: 'Quinta', curto: 'Qui' },
  { n: 5, label: 'Sexta', curto: 'Sex' }
];

// Níveis de alerta para STC prontificada parada esperando retirada.
export const NIVEIS_COBRANCA = [
  { key: 'verde', limite: 7, label: 'No prazo', tom: 'emerald' },
  { key: 'amarelo', limite: 15, label: 'Atenção', tom: 'amber' },
  { key: 'vermelho', limite: Infinity, label: 'Cobrar o CDAM', tom: 'red' }
];

export const nivelCobranca = (dias) =>
  NIVEIS_COBRANCA.find(n => (dias ?? 0) <= n.limite) || NIVEIS_COBRANCA[NIVEIS_COBRANCA.length - 1];

export const configVazia = (cam) => ({
  cam,
  sigla: '',
  tratamento: TRATAMENTOS.PENDENTE,
  documentoEsperado: null,
  diasRota: [],
  janelaInicio: null,
  janelaFim: null,
  observacao: ''
});

export const rotaDescrita = (c) => {
  if (!c) return '—';
  if (c.tratamento === TRATAMENTOS.GTC) {
    if (!c.diasRota?.length) return 'sem dia definido';
    return c.diasRota.slice().sort().map(n => DIAS_UTEIS.find(d => d.n === n)?.curto || n).join(', ');
  }
  if (c.tratamento === TRATAMENTOS.STC) {
    if (!c.janelaInicio || !c.janelaFim) return 'sem janela definida';
    return `dia ${String(c.janelaInicio).padStart(2, '0')} a ${String(c.janelaFim).padStart(2, '0')}`;
  }
  return '—';
};

export const configCompleta = (c) => {
  if (!c) return false;
  if (c.tratamento === TRATAMENTOS.GTC) return Boolean(c.diasRota?.length);
  if (c.tratamento === TRATAMENTOS.STC) return Boolean(c.janelaInicio && c.janelaFim);
  return c.tratamento === TRATAMENTOS.OCULTO;
};

// ── Prazos que a rota impõe à separação ─────────────────────────────
// É aqui que o cadastro deixa de ser enfeite: cada CAM passa a ter um
// prazo recorrente. Separar depois que o caminhão passou custa uma
// semana inteira de espera na Expedição.

// Próxima data em que a rota do CAM passa, a partir de uma data.
export const proximaRota = (config, aPartirDe = hojeIso()) => {
  if (config?.tratamento !== TRATAMENTOS.GTC || !config.diasRota?.length) return null;
  const dias = new Set(config.diasRota);
  for (let n = 0; n <= 14; n++) {
    const dia = somaDias(aPartirDe, n);
    if (dias.has(diaDaSemana(dia))) return dia;
  }
  return null;
};

// Último dia da próxima janela de inserção da STC, a partir de uma data.
export const proximaJanela = (config, aPartirDe = hojeIso()) => {
  if (config?.tratamento !== TRATAMENTOS.STC || !config.janelaInicio || !config.janelaFim) return null;
  const { ano, mes, dia } = isoParaPartes(aPartirDe);
  const monta = (a, m) => {
    const ultimoDoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const fim = Math.min(config.janelaFim, ultimoDoMes);
    return {
      inicio: `${a}-${String(m).padStart(2, '0')}-${String(config.janelaInicio).padStart(2, '0')}`,
      fim: `${a}-${String(m).padStart(2, '0')}-${String(fim).padStart(2, '0')}`
    };
  };
  const desteMes = monta(ano, mes);
  if (dia <= config.janelaFim) return desteMes;
  return mes === 12 ? monta(ano + 1, 1) : monta(ano, mes + 1);
};

// O prazo que a rota impõe: até quando a RM precisa estar CONFERIDA
// para pegar a próxima saída. Um dia antes da rota, porque a Expedição
// precisa montar o mapa e prontificar.
export const prazoDaRota = (config, aPartirDe = hojeIso(), folgaDias = 1) => {
  if (config?.tratamento === TRATAMENTOS.GTC) {
    const rota = proximaRota(config, aPartirDe);
    return rota ? { tipo: 'GTC', saida: rota, conferirAte: somaDias(rota, -folgaDias) } : null;
  }
  if (config?.tratamento === TRATAMENTOS.STC) {
    const janela = proximaJanela(config, aPartirDe);
    return janela ? { tipo: 'STC', saida: janela.fim, conferirAte: somaDias(janela.inicio, -folgaDias), janela } : null;
  }
  return null;
};

export const DIAS_CURTOS_SEMANA = DIAS_CURTOS;
