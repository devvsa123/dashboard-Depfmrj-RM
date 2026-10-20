import { classifyStc } from '../../hooks/useStcGtcAnalysis';
import { diffDias, hojeIso, somaDiasUteis, formatarBr } from './semana';
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

// ── O roteiro da semana ─────────────────────────────────────────────

// CAMs de STC ordenados pela janela do CDAM, marcando os que precisam
// fechar ainda nesta semana.
export const janelasDaSemana = (filas, inicioSemana, fimSemana) =>
  filas.stc
    .filter(g => g.aProntificar.length > 0 || g.inseridas.length > 0)
    .map(g => ({
      ...g,
      nestaSemana: Boolean(g.janela && g.janela.inicio <= fimSemana && g.janela.fim >= inicioSemana)
    }))
    // Ordena pelo fim da janela, não pelo fato de ela cair na semana do
    // documento: o que fecha antes é o que precisa ser lançado antes,
    // mesmo que a janela termine antes da semana começar — nesse caso o
    // prazo já está correndo e atrasar significa esperar o mês seguinte.
    .sort((a, b) => {
      if (a.proximaSaida && b.proximaSaida && a.proximaSaida !== b.proximaSaida) return a.proximaSaida.localeCompare(b.proximaSaida);
      if (a.proximaSaida && !b.proximaSaida) return -1;
      if (!a.proximaSaida && b.proximaSaida) return 1;
      return b.faltamFechar - a.faltamFechar;
    });


// ── A linha de produção da Expedição ────────────────────────────────
//
// Esta projeção enxerga SÓ as RMs da programação da separação. O que
// ficou de trás — STC antigas em aberto, documento parado esperando o
// CDAM — é tratado nas filas desta mesma aba, e de propósito fica fora
// do documento: misturar os dois fazia a ordem de serviço da semana
// carregar pendência de meses atrás e deixar de ser legível.
//
// O que eu programei para separar, eu levo até a Expedição, que
// prontifica e, quando for o caso, expede:
//
//   dia D    — a estocagem conclui a RM (status CONFERIDO)
//   dia D+1  — o material chega à Expedição
//   até D+4  — prazo para PRONTIFICAR: lançar a STC ou a GTC em todas
//              as RMs do lote (3 dias úteis a contar da chegada)
//   depois   — a STC prontificada está PRONTA, acabou para nós;
//              a GTC ainda precisa do status EXPEDIDO, no dia da rota
//
// O prazo é o menor entre os 3 dias úteis, o prazo da mensagem que
// originou a RM e o dia da rota do CAM — nunca mais que isso. A janela
// do CDAM NÃO empurra o prazo para frente: ela é critério de quando
// separar, não de quando trabalhar, e empurrando virava "prontificar
// até 19/11" numa programação da semana de 26 a 30/10.

export const DIAS_EXPEDICAO = 3;

export const ESTADOS = {
  NAO_CHEGOU: { key: 'NAO_CHEGOU', label: 'ainda na separação', tom: 'slate' },
  A_PRONTIFICAR: { key: 'A_PRONTIFICAR', label: 'a prontificar', tom: 'amber' },
  PRONTA: { key: 'PRONTA', label: 'STC lançada — pronta', tom: 'emerald' },
  A_ENTREGAR: { key: 'A_ENTREGAR', label: 'GTC lançada — a expedir', tom: 'indigo' },
  EXPEDIDA: { key: 'EXPEDIDA', label: 'expedida', tom: 'emerald' },
  CANCELADA: { key: 'CANCELADA', label: 'cancelada', tom: 'slate' }
};

// Onde cada RM da programação está agora, segundo o WMS. É isto que
// transforma o documento em acompanhamento: a mesma folha diz o que
// fazer e o que já foi feito.
const estadoDaRm = (info) => {
  if (!info) return ESTADOS.NAO_CHEGOU;
  const situacao = String(info.situacao || '').toUpperCase().trim();
  if (situacao === 'CANCELADO') return ESTADOS.CANCELADA;
  if (situacao === 'EXPEDIDO') return ESTADOS.EXPEDIDA;
  if (situacao !== 'CONFERIDO') return ESTADOS.NAO_CHEGOU;
  const doc = classifyStc(info.documento);
  if (!doc) return ESTADOS.A_PRONTIFICAR;
  // Para a STC o trabalho acaba no lançamento; a GTC ainda tem de sair.
  return doc === 'STC' ? ESTADOS.PRONTA : ESTADOS.A_ENTREGAR;
};

const menorData = (a, b) => (!a ? b : !b ? a : (a <= b ? a : b));

const prazoDoBloco = ({ chegouEm, prazoDemanda, rota, forcado }) => {
  // Texto curto: numa tabela de trinta linhas a regra inteira repetida
  // vira ruído. A regra está no texto da seção; aqui só é preciso dizer
  // QUAL dos prazos mandou.
  const candidatos = [
    { data: somaDiasUteis(chegouEm, DIAS_EXPEDICAO), motivo: `Prazo da Expedição (${DIAS_EXPEDICAO} d. úteis)` }
  ];
  if (prazoDemanda) candidatos.push({ data: prazoDemanda, motivo: `Prazo de mensagem (${formatarBr(prazoDemanda)})` });
  if (rota) candidatos.push({ data: rota, motivo: `Rota do CAM (${formatarBr(rota)})` });
  const vencedor = candidatos.reduce((a, b) => (a.data <= b.data ? a : b));
  return {
    prazo: vencedor.data,
    motivo: forcado ? 'Atendimento forçado pelo programador' : vencedor.motivo
  };
};

export const projetarExpedicao = ({ snapshot, indiceWms, dias, porCam, forcados = [], hoje = hojeIso() }) => {
  const forcadosSet = new Set(forcados || []);
  const primeiroDia = dias[0];
  const ultimoDia = dias[dias.length - 1];

  // ── Uma linha por RM da programação, com o estado de agora ────────
  const itens = [];
  (snapshot?.grade || []).forEach(slot => slot.alocacoes.forEach(a => {
    const info = indiceWms?.get(a.rm);
    itens.push({
      rm: a.rm,
      cam: a.cam || '(sem CAM)',
      separadaEm: slot.dia,
      chegouEm: somaDiasUteis(slot.dia, 1),
      prazoDemanda: a.prazo || null,
      estado: estadoDaRm(info),
      documento: info?.documento || '',
      // O tipo vem do documento que ESTÁ lançado, não do que o cadastro
      // esperava: é possível lançar uma STC num CAM de GTC, e o anexo
      // precisa dizer o que há, não o que deveria haver.
      tipoDoc: classifyStc(info?.documento)
    });
  }));

  // ── Blocos: um por CAM e por dia de chegada ───────────────────────
  const porChegada = new Map();
  itens.forEach(item => {
    if (item.estado === ESTADOS.CANCELADA) return;
    const chave = `${item.chegouEm}||${item.cam}`;
    if (!porChegada.has(chave)) {
      const config = porCam?.get(item.cam) || configVazia(item.cam);
      porChegada.set(chave, {
        cam: item.cam, config, sigla: config.sigla || item.cam, tratamento: config.tratamento,
        chegouEm: item.chegouEm,
        rota: config.tratamento === TRATAMENTOS.GTC ? proximaRota(config, item.chegouEm) : null,
        janela: config.tratamento === TRATAMENTOS.STC ? proximaJanela(config, item.chegouEm) : null,
        rms: [], prazoDemanda: null, forcado: forcadosSet.has(item.cam)
      });
    }
    const b = porChegada.get(chave);
    b.rms.push(item);
    b.prazoDemanda = menorData(b.prazoDemanda, item.prazoDemanda);
  });

  const contar = (rms, estado) => rms.filter(r => r.estado === estado).length;

  const blocos = Array.from(porChegada.values()).map(b => {
    const { prazo, motivo } = prazoDoBloco(b);
    const docEsperado = b.config.documentoEsperado
      || (b.tratamento === TRATAMENTOS.GTC ? 'GTC' : b.tratamento === TRATAMENTOS.STC ? 'STC' : '—');
    return {
      ...b,
      qtd: b.rms.length,
      prazo,
      motivo,
      documentoEsperado: docEsperado,
      naSeparacao: contar(b.rms, ESTADOS.NAO_CHEGOU),
      aProntificar: contar(b.rms, ESTADOS.A_PRONTIFICAR),
      prontas: contar(b.rms, ESTADOS.PRONTA),
      aEntregar: contar(b.rms, ESTADOS.A_ENTREGAR),
      expedidas: contar(b.rms, ESTADOS.EXPEDIDA),
      // Falta prontificar o que ainda não ganhou documento, inclusive o
      // que nem chegou: é tudo trabalho do mesmo lote.
      get falta() { return this.naSeparacao + this.aProntificar; }
    };
  });

  // Um CAM pode ter dois lotes que chegam ou saem no mesmo dia. Para a
  // Expedição é um serviço só — um lançamento, um caminhão.
  const mesclarPorCam = (lista) => {
    const mapa = new Map();
    lista.forEach(b => {
      if (!mapa.has(b.cam)) {
        mapa.set(b.cam, {
          ...b, qtd: 0, rms: [], naSeparacao: 0, aProntificar: 0, prontas: 0, aEntregar: 0, expedidas: 0,
          get falta() { return this.naSeparacao + this.aProntificar; }
        });
      }
      const x = mapa.get(b.cam);
      x.qtd += b.qtd;
      x.rms = x.rms.concat(b.rms);
      x.naSeparacao += b.naSeparacao;
      x.aProntificar += b.aProntificar;
      x.prontas += b.prontas;
      x.aEntregar += b.aEntregar;
      x.expedidas += b.expedidas;
      x.prazo = menorData(x.prazo, b.prazo);
      x.forcado = x.forcado || b.forcado;
    });
    return Array.from(mapa.values());
  };

  const ordenar = (lista, campo) => lista.slice().sort((a, b) => {
    if (Boolean(a.forcado) !== Boolean(b.forcado)) return a.forcado ? -1 : 1;
    if (a[campo] && b[campo] && a[campo] !== b[campo]) return a[campo].localeCompare(b[campo]);
    return b.qtd - a.qtd;
  });

  const naSemana = (data) => Boolean(data) && data >= primeiroDia && data <= ultimoDia;

  const agenda = dias.map(dia => {
    const prontificar = ordenar(mesclarPorCam(blocos.filter(b => b.chegouEm === dia)), 'prazo');
    // Entrega: GTC cuja rota é hoje e que ainda não saiu inteira.
    const entregar = ordenar(mesclarPorCam(
      blocos.filter(b => b.tratamento === TRATAMENTOS.GTC && b.rota === dia && b.expedidas < b.qtd)
    ), 'rota');
    return {
      dia,
      prontificar,
      entregar,
      total: prontificar.reduce((t, b) => t + b.qtd, 0),
      temTrabalho: prontificar.length + entregar.length > 0
    };
  });

  const depois = {
    prontificar: ordenar(mesclarPorCam(blocos.filter(b => !naSemana(b.chegouEm))), 'chegouEm'),
    entregar: ordenar(mesclarPorCam(
      blocos.filter(b => b.tratamento === TRATAMENTOS.GTC && b.rota && !naSemana(b.rota) && b.expedidas < b.qtd)
    ), 'rota')
  };
  depois.temTrabalho = depois.prontificar.length + depois.entregar.length > 0;

  const soma = (campo) => blocos.reduce((t, b) => t + b[campo], 0);

  return {
    hoje,
    agenda,
    depois,
    blocos,
    temPlano: Boolean(snapshot),
    resumo: {
      total: itens.length,
      canceladas: itens.filter(i => i.estado === ESTADOS.CANCELADA).length,
      naSeparacao: soma('naSeparacao'),
      aProntificar: soma('aProntificar'),
      prontas: soma('prontas'),
      aEntregar: soma('aEntregar'),
      expedidas: soma('expedidas'),
      foraDaSemana: blocos.filter(b => !naSemana(b.chegouEm)).reduce((t, b) => t + b.qtd, 0)
    }
  };
};
