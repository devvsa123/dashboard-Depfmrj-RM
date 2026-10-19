import { classifyStc } from '../../hooks/useStcGtcAnalysis';
import { diffDias, hojeIso } from './semana';
import { TRATAMENTOS, proximaRota, proximaJanela, nivelCobranca, configVazia } from './rotas';

// A fila da Expedição — o trecho do processo que começa onde a
// programação da separação termina.
//
// O caminho de uma RM depois de CONFERIDA:
//
//   CONFERIDA sem documento   → a Expedição monta o mapa de carregamento
//                               e atrela o mapa a uma GTC ou a uma STC
//   CONFERIDA com GTC         → nós entregamos; acaba em EXPEDIDO
//   CONFERIDA com STC         → o CDAM retira; para nós acaba quando a
//                               STC está lançada, mas o material só sai
//                               da casa quando eles vêm buscar
//
// Daí as três filas desta tela terem fins diferentes, e isso é de
// propósito: cobrar EXPEDIDO de uma STC seria cobrar trabalho que não é
// nosso. O que podemos fazer com a STC parada é avisar o CDAM — e é
// para isso que serve a fila de cobrança.

export const ETAPAS = {
  PRONTIFICAR: 'PRONTIFICAR',
  ENTREGAR: 'ENTREGAR',
  AGUARDANDO_CDAM: 'AGUARDANDO_CDAM'
};

const CONFERIDO = 'CONFERIDO';
const EXPEDIDO = 'EXPEDIDO';
const CANCELADO = 'CANCELADO';

// Há quantos dias o material está parado na Expedição. A data que temos
// é a do último movimento — em linha CONFERIDA, a da própria
// conferência. O WMS não guarda quando a STC foi inserida, então esta é
// a medida honesta: tempo de casa depois de pronto, não tempo de STC.
const diasParado = (info, hoje) => (info.movimento ? Math.max(0, diffDias(info.movimento, hoje)) : null);

const ordenarPorEspera = (a, b) => {
  if (a.movimento && b.movimento) return a.movimento.localeCompare(b.movimento);
  if (a.movimento) return -1;
  if (b.movimento) return 1;
  return a.rm.localeCompare(b.rm);
};

// Agrupa as RMs da Expedição por CAM e separa, dentro de cada CAM, o que
// falta fazer. Recebe o índice do WMS e o cadastro de rotas.
export const montarFilasExpedicao = (indiceWms, porCam, hoje = hojeIso()) => {
  const grupos = new Map();
  const pegar = (cam) => {
    if (!grupos.has(cam)) {
      grupos.set(cam, {
        cam,
        config: porCam?.get(cam) || configVazia(cam),
        aProntificar: [],
        aEntregar: [],
        inseridas: [],
        naSeparacao: 0,
        expedidas: 0,
        divergentes: 0
      });
    }
    return grupos.get(cam);
  };

  (indiceWms || new Map()).forEach(info => {
    const cam = info.cam || '—';
    const situacao = String(info.situacao || '').toUpperCase().trim();
    if (situacao === CANCELADO) return;

    const g = pegar(cam);
    if (situacao === EXPEDIDO) { g.expedidas++; return; }
    if (situacao !== CONFERIDO) { g.naSeparacao++; return; }

    const doc = classifyStc(info.documento);
    const linha = { ...info, dias: diasParado(info, hoje) };

    if (!doc) { g.aProntificar.push(linha); return; }

    // Documento lançado diferente do esperado para o CAM. Não é erro
    // automático — o Núcleo de Implantação é STC na prática e GTC no
    // sistema — mas vale mostrar.
    const esperado = g.config.documentoEsperado;
    if (esperado && doc !== esperado) g.divergentes++;

    // Quem decide a fila é o TRATAMENTO, não o tipo do documento. No
    // Núcleo de Implantação a empresa é que retira, e mesmo assim o
    // documento lançado é GTC; roteando pelo documento, essas RMs
    // entrariam na fila de entrega nossa e sumiriam da tela de quem
    // precisa cobrar a retirada.
    const nossa = g.config.tratamento === TRATAMENTOS.GTC
      || (g.config.tratamento === TRATAMENTOS.PENDENTE && doc === 'GTC');

    if (nossa) g.aEntregar.push({ ...linha, documento: info.documento, tipoDoc: doc });
    else g.inseridas.push({ ...linha, documento: info.documento, tipoDoc: doc, nivel: nivelCobranca(linha.dias) });
  });

  const lista = Array.from(grupos.values());
  lista.forEach(g => {
    g.aProntificar.sort(ordenarPorEspera);
    g.aEntregar.sort(ordenarPorEspera);
    g.inseridas.sort(ordenarPorEspera);
    g.sigla = g.config.sigla || g.cam;
    g.tratamento = g.config.tratamento;
    g.maisAntiga = g.aProntificar[0]?.dias ?? null;

    // O fim do processo da STC é por CAM: a STC precisa estar lançada em
    // todas as RM não canceladas. "Faltam N" conta o que já está pronto
    // na Expedição e ainda sem documento; o que está na separação entra
    // depois e aparece à parte, para não prometer um fechamento que
    // ainda depende do depósito.
    g.faltamFechar = g.aProntificar.length;
    g.fechado = g.faltamFechar === 0 && (g.inseridas.length > 0 || g.aEntregar.length > 0);

    if (g.tratamento === TRATAMENTOS.GTC) {
      g.proximaSaida = proximaRota(g.config, hoje);
    } else if (g.tratamento === TRATAMENTOS.STC) {
      g.janela = proximaJanela(g.config, hoje);
      g.proximaSaida = g.janela?.fim || null;
    }
    g.temTrabalho = g.aProntificar.length + g.aEntregar.length > 0;
  });

  const ativos = lista.filter(g => g.tratamento !== TRATAMENTOS.OCULTO);
  const porVolume = (a, b) =>
    (b.aProntificar.length + b.aEntregar.length) - (a.aProntificar.length + a.aEntregar.length);

  const gtc = ativos.filter(g => g.tratamento === TRATAMENTOS.GTC).sort(porVolume);
  const stc = ativos.filter(g => g.tratamento === TRATAMENTOS.STC).sort(porVolume);
  const semCadastro = ativos
    .filter(g => g.tratamento === TRATAMENTOS.PENDENTE && g.temTrabalho)
    .sort(porVolume);

  const cobranca = montarCobranca(ativos);

  const somar = (arr, campo) => arr.reduce((t, g) => t + g[campo].length, 0);
  const resumo = {
    aProntificar: somar(ativos, 'aProntificar'),
    gtcAEntregar: somar(gtc, 'aEntregar') + somar(semCadastro, 'aEntregar'),
    stcACobrar: cobranca.reduce((t, d) => t + d.qtd, 0),
    documentosParados: cobranca.length,
    vermelhos: cobranca.filter(d => d.nivel.key === 'vermelho').reduce((t, d) => t + d.qtd, 0),
    amarelos: cobranca.filter(d => d.nivel.key === 'amarelo').reduce((t, d) => t + d.qtd, 0),
    camsSemCadastro: semCadastro.length,
    camsAFechar: stc.filter(g => g.faltamFechar > 0).length,
    divergentes: ativos.reduce((t, g) => t + g.divergentes, 0)
  };

  return { hoje, grupos: ativos, gtc, stc, semCadastro, cobranca, resumo };
};

// A cobrança é por DOCUMENTO, não por RM: o CDAM vem buscar uma STC, que
// pode carregar várias RMs. A idade do documento é a da RM que está
// esperando há mais tempo dentro dele.
export const montarCobranca = (grupos) => {
  const docs = new Map();
  grupos.forEach(g => {
    g.inseridas.forEach(l => {
      const chave = String(l.documento || '').trim().toUpperCase();
      if (!docs.has(chave)) {
        docs.set(chave, { documento: l.documento, cam: g.cam, sigla: g.sigla, rms: [], desde: l.movimento, dias: l.dias ?? 0 });
      }
      const d = docs.get(chave);
      d.rms.push(l.rm);
      if (l.movimento && (!d.desde || l.movimento < d.desde)) d.desde = l.movimento;
      if ((l.dias ?? 0) > d.dias) d.dias = l.dias ?? 0;
    });
  });
  return Array.from(docs.values())
    .map(d => ({ ...d, qtd: d.rms.length, nivel: nivelCobranca(d.dias) }))
    .sort((a, b) => b.dias - a.dias);
};
