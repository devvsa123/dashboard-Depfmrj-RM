import { somaDias, somaDiasUteis, diaDaSemana, DIAS_CURTOS, isoParaPartes, hojeIso } from './semana';

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

// O prazo que a rota impõe: até quando a RM precisa estar CONFERIDA para
// pegar a próxima saída. A folga é contada em DIAS ÚTEIS, e não em dias
// corridos, por um motivo prático: numa rota de segunda, a véspera é o
// domingo. Contando em dia corrido o prazo cairia fora de qualquer semana
// programada e o CAM nunca seria priorizado — o depósito separaria para
// ele sempre depois do caminhão passar. Em dia útil a véspera é a sexta
// anterior, que é quando o trabalho de fato precisa estar pronto.
//
// E a saída procurada é a próxima ALCANÇÁVEL: se a conferência já não dá
// mais tempo para a rota desta semana, o prazo é o da seguinte. Prometer
// um caminhão que já passou não ajuda ninguém.
export const prazoDaRota = (config, aPartirDe = hojeIso(), folgaDias = 1) => {
  if (config?.tratamento === TRATAMENTOS.GTC) {
    let cursor = aPartirDe;
    for (let i = 0; i < 4; i++) {
      const rota = proximaRota(config, cursor);
      if (!rota) return null;
      const conferirAte = somaDiasUteis(rota, -folgaDias);
      if (conferirAte >= aPartirDe) return { tipo: 'GTC', saida: rota, conferirAte };
      cursor = somaDias(rota, 1);
    }
    return null;
  }
  if (config?.tratamento === TRATAMENTOS.STC) {
    let cursor = aPartirDe;
    for (let i = 0; i < 3; i++) {
      const janela = proximaJanela(config, cursor);
      if (!janela) return null;
      // Mira o começo da janela, para a STC poder ser lançada no primeiro
      // dia. Se a janela já começou, o que resta é o último dia dela.
      const alvo = janela.inicio > aPartirDe ? janela.inicio : janela.fim;
      const conferirAte = somaDiasUteis(alvo, -folgaDias);
      if (conferirAte >= aPartirDe) return { tipo: 'STC', saida: janela.fim, conferirAte, janela };
      cursor = somaDias(janela.fim, 1);
    }
    return null;
  }
  return null;
};

export const DIAS_CURTOS_SEMANA = DIAS_CURTOS;
