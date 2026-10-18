import { safeGetISODate } from '../dates';
import { diaDaSemana, dateParaIso, somaDias, DIAS_CURTOS } from './semana';

// Capacidade de atendimento por dia da semana, medida no histórico.
//
// Por que MÉDIA e não mediana: a operação trabalha em batelada — há
// segundas com 677 RMs e segundas com zero. A mediana de cada dia soma
// cerca de 275 RMs/semana, enquanto a vazão real passa de 420; planejar
// pela mediana subestimaria a semana em mais de um terço. A média de cada
// dia da semana, contando os dias parados como zero, reproduz a vazão real
// e — testada em janelas de 12 semanas e de 12 meses — mantém a mesma
// forma: segunda a quinta parecidas, sexta na metade.
//
// Os dias sem movimento ENTRAM no cálculo como zero, de propósito: feriado
// e dia parado fazem parte da vazão média de um dia daquele tipo.

export const JANELAS = [
  { key: 'd90', label: '12 semanas', dias: 84 },
  { key: 'd180', label: '6 meses', dias: 182 },
  { key: 'd365', label: '12 meses', dias: 365 }
];

export const medirCapacidade = (data, janelaDias = 365) => {
  if (!data || !data.length) return null;

  // Só linhas já expedidas têm data de saída confiável; nas demais a
  // DATA_SEPARACAO guarda o último movimento, não a expedição.
  const porDia = new Map();
  let ultimaData = null;
  data.forEach(item => {
    if (String(item.STATUS || '').toUpperCase().trim() !== 'EXPEDIDO') return;
    const iso = safeGetISODate(item.DATA_SEPARACAO);
    if (!iso) return;
    const rm = String(item.PEDIDO || '').trim();
    if (!rm) return;
    if (!porDia.has(iso)) porDia.set(iso, new Set());
    porDia.get(iso).add(rm);
    if (!ultimaData || iso > ultimaData) ultimaData = iso;
  });
  if (!ultimaData) return null;

  const inicio = somaDias(ultimaData, -janelaDias);

  // Percorre todos os dias da janela, inclusive os sem movimento.
  const soma = [0, 0, 0, 0, 0, 0, 0];
  const contagem = [0, 0, 0, 0, 0, 0, 0];
  let dia = inicio;
  while (dia <= ultimaData) {
    const d = diaDaSemana(dia);
    contagem[d]++;
    soma[d] += porDia.has(dia) ? porDia.get(dia).size : 0;
    dia = somaDias(dia, 1);
  }

  const porDiaSemana = {};
  let totalSemanal = 0;
  for (let d = 1; d <= 5; d++) {
    const media = contagem[d] ? soma[d] / contagem[d] : 0;
    porDiaSemana[d] = Math.round(media);
    totalSemanal += porDiaSemana[d];
  }

  const forma = {};
  for (let d = 1; d <= 5; d++) {
    forma[d] = totalSemanal ? parseFloat(((porDiaSemana[d] / totalSemanal) * 100).toFixed(1)) : 0;
  }

  return {
    porDiaSemana,
    forma,
    totalSemanal,
    janelaDias,
    inicio,
    fim: ultimaData,
    diaMaisFraco: DIAS_CURTOS[[1, 2, 3, 4, 5].reduce((a, b) => (porDiaSemana[a] <= porDiaSemana[b] ? a : b))],
    diaMaisForte: DIAS_CURTOS[[1, 2, 3, 4, 5].reduce((a, b) => (porDiaSemana[a] >= porDiaSemana[b] ? a : b))]
  };
};

// O que JÁ SAIU da fila de separação. CONFERIDO entra aqui: nesse ponto o
// pedido está pronto e entregue à Expedição, então o trabalho do depósito
// naquela RM acabou — programá-la de novo seria contar duas vezes. É a
// mesma régua que define "atendido" para efeito de prazo.
export const STATUS_FORA_DA_FILA = new Set(['CONFERIDO', 'EXPEDIDO', 'CANCELADO']);

export const estaNaFila = (situacao) => !STATUS_FORA_DA_FILA.has(String(situacao || '').toUpperCase().trim());

// Índice rápido RM -> situação atual no WMS, usado para conferir as RMs
// coladas e para montar a fila de atendimento.
export const indexarWms = (data) => {
  const indice = new Map();
  (data || []).forEach(item => {
    const rm = String(item.PEDIDO || '').trim();
    if (!rm) return;
    const situacao = String(item.STATUS || '').toUpperCase().trim();
    const entrada = safeGetISODate(item.DATA_ENTRADA);
    const atual = indice.get(rm);
    // Uma RM pode ter mais de uma linha (liberações parciais). Para efeito
    // de programação ela é uma só: fica em fila se QUALQUER linha estiver
    // em fila, e vale a entrada mais antiga.
    if (!atual) {
      indice.set(rm, {
        rm,
        situacao,
        cam: String(item.CAM || '').trim(),
        documento: String(item.STC || '').trim(),
        tipoRm: String(item.TIPO_RM || '').trim(),
        entrada,
        linhas: 1
      });
      return;
    }
    atual.linhas++;
    if (entrada && (!atual.entrada || entrada < atual.entrada)) atual.entrada = entrada;
    if (estaNaFila(situacao) && !estaNaFila(atual.situacao)) atual.situacao = situacao;
  });
  return indice;
};

// A fila de SEPARAÇÃO: RMs que ainda dependem de trabalho do depósito, da
// mais antiga para a mais nova. É a ordem padrão de atendimento quando não
// há prazo mandando. Não confundir com a "fila em aberto" das outras abas
// do dashboard, que inclui as CONFERIDAS aguardando expedição.
export const filaPorAntiguidade = (indiceWms, hojeIso) => {
  const fila = [];
  indiceWms.forEach(info => {
    if (!estaNaFila(info.situacao)) return;
    fila.push({
      ...info,
      diasEmFila: info.entrada ? Math.max(0, Math.round((new Date(hojeIso) - new Date(info.entrada)) / 86400000)) : null
    });
  });
  fila.sort((a, b) => {
    if (!a.entrada) return 1;
    if (!b.entrada) return -1;
    return a.entrada.localeCompare(b.entrada);
  });
  return fila;
};

export const dateIsoDeHoje = () => dateParaIso(new Date());
