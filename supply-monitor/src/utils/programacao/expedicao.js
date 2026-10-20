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
// A separação diz o que o depósito conclui em cada dia. A Expedição tem
// o seu próprio relógio a partir daí, e é ele que esta projeção monta:
//
//   dia D    — a estocagem conclui a RM (status CONFERIDO)
//   dia D+1  — o material chega à Expedição e entra na fila dela
//   até D+4  — prazo para tratar: montar o mapa e lançar o documento
//              (3 dias úteis a contar da chegada, para RM comum)
//   depois   — a GTC sai na rota do CAM; a STC fica lançada esperando
//              o CDAM retirar
//
// O prazo de uma RM comum é o prazo de 3 dias. O de uma RM que veio de
// mensagem é o prazo da própria mensagem. E nenhum dos dois vale se a
// saída do CAM vier antes: de nada serve ter 3 dias se o caminhão
// daquele cliente passa amanhã, ou se a janela do CDAM fecha depois de
// amanhã. Por isso o prazo de cada bloco é o MENOR dos três, e o
// documento imprime qual deles mandou — é esse dia que se cobra.

export const DIAS_EXPEDICAO = 3;

const menorData = (a, b) => (!a ? b : !b ? a : (a <= b ? a : b));

// O prazo de um bloco e a razão dele, escolhendo entre o prazo próprio
// da Expedição, o prazo da mensagem e a saída do CAM.
const prazoDoBloco = ({ chegouEm, prazoDemanda, rota, janela, forcado }) => {
  // O texto é curto de propósito: numa tabela de trinta linhas a regra
  // inteira repetida em cada uma vira ruído. A regra está no texto da
  // seção; aqui só precisa dizer QUAL dos prazos mandou.
  const candidatos = [
    { data: somaDiasUteis(chegouEm, DIAS_EXPEDICAO), motivo: `Prazo da Expedição (${DIAS_EXPEDICAO} d. úteis)` }
  ];
  if (prazoDemanda) candidatos.push({ data: prazoDemanda, motivo: `Prazo de mensagem (${formatarBr(prazoDemanda)})` });
  if (rota) candidatos.push({ data: rota, motivo: `Rota do CAM (${formatarBr(rota)})` });
  if (janela) candidatos.push({ data: janela.fim, motivo: `Janela do CDAM (até ${formatarBr(janela.fim)})` });

  const vencedor = candidatos.reduce((a, b) => (a.data <= b.data ? a : b));

  // A STC só pode ser lançada DENTRO da janela do CDAM. Sem isto, uma
  // RM que chega muito antes da janela abrir ganhava prazo pelos 3 dias
  // e o documento mandava lançar numa data em que o CDAM ainda não
  // aceita — cobrança impossível de cumprir.
  if (janela && vencedor.data < janela.inicio) {
    return {
      prazo: janela.inicio,
      motivo: forcado ? 'Atendimento forçado pelo programador' : `Janela do CDAM (abre em ${formatarBr(janela.inicio)})`
    };
  }

  return {
    prazo: vencedor.data,
    motivo: forcado ? 'Atendimento forçado pelo programador' : vencedor.motivo
  };
};

export const projetarExpedicao = ({ filas, snapshot, dias, porCam, forcados = [], hoje = hojeIso() }) => {
  const forcadosSet = new Set(forcados || []);
  const primeiroDia = dias[0];
  const ultimoDia = dias[dias.length - 1];
  const itens = [];

  // O que já está conferido e sem documento chega no primeiro dia da
  // semana: é trabalho atrasado, não trabalho desta semana.
  (filas?.grupos || []).forEach(g => g.aProntificar.forEach(l => itens.push({
    rm: l.rm, cam: g.cam, chegouEm: primeiroDia, atrasada: true,
    prazoDemanda: null, entrada: l.entrada, diasEmFila: l.dias
  })));

  // O que a separação entrega: chega no dia útil seguinte ao da
  // conclusão, inclusive quando isso cai na semana seguinte.
  (snapshot?.grade || []).forEach(slot => slot.alocacoes.forEach(a => itens.push({
    rm: a.rm, cam: a.cam || '(sem CAM)', chegouEm: somaDiasUteis(slot.dia, 1), separadaEm: slot.dia,
    atrasada: false, prazoDemanda: a.prazo || null, entrada: null, diasEmFila: a.diasEmFila ?? null
  })));

  // ── Blocos de chegada: um por CAM e por dia de chegada ────────────
  const chegadas = new Map();
  itens.forEach(item => {
    const chave = `${item.chegouEm}||${item.cam}`;
    if (!chegadas.has(chave)) {
      const config = porCam?.get(item.cam) || configVazia(item.cam);
      const rota = config.tratamento === TRATAMENTOS.GTC ? proximaRota(config, item.chegouEm) : null;
      const janela = config.tratamento === TRATAMENTOS.STC ? proximaJanela(config, item.chegouEm) : null;
      chegadas.set(chave, {
        cam: item.cam, config, sigla: config.sigla || item.cam, tratamento: config.tratamento,
        chegouEm: item.chegouEm, rota, janela, rms: [], atrasadas: 0,
        prazoDemanda: null, forcado: forcadosSet.has(item.cam)
      });
    }
    const b = chegadas.get(chave);
    b.rms.push(item);
    if (item.atrasada) b.atrasadas++;
    b.prazoDemanda = menorData(b.prazoDemanda, item.prazoDemanda);
  });

  const blocos = Array.from(chegadas.values()).map(b => {
    const { prazo, motivo } = prazoDoBloco(b);
    return { ...b, qtd: b.rms.length, prazo, motivo, saiEm: b.rota || b.janela?.fim || null };
  });

  // ── Entregas de GTC já lançadas ───────────────────────────────────
  // Material com documento pronto, esperando o dia da rota. Entra na
  // linha de produção pelo dia da saída, não pelo da chegada.
  const entregasProntas = [];
  (filas?.gtc || []).forEach(g => {
    if (!g.aEntregar.length) return;
    const porDoc = new Map();
    g.aEntregar.forEach(l => {
      const chave = String(l.documento || '').trim() || '(sem número)';
      if (!porDoc.has(chave)) porDoc.set(chave, []);
      porDoc.get(chave).push(l);
    });
    const saida = proximaRota(g.config, hoje) || primeiroDia;
    entregasProntas.push({
      cam: g.cam, sigla: g.config.sigla || g.cam, config: g.config,
      saiEm: saida, qtd: g.aEntregar.length,
      documentos: Array.from(porDoc.entries()).map(([doc, rms]) => ({ documento: doc, rms })),
      rms: g.aEntregar,
      forcado: forcadosSet.has(g.cam)
    });
  });

  // ── Monta a agenda: cada dia com as três etapas ───────────────────
  // Um CAM pode ter dois lotes de chegada que vencem ou saem no mesmo
  // dia. Para a Expedição isso é um serviço só — um caminhão, um
  // lançamento —, então os lotes são mesclados por cliente.
  const mesclarPorCam = (lista) => {
    const mapa = new Map();
    lista.forEach(b => {
      // Os acumuladores entram zerados no espalhamento, senão o
      // primeiro lote seria contado duas vezes.
      if (!mapa.has(b.cam)) mapa.set(b.cam, { ...b, qtd: 0, rms: [], documentos: [], aLancar: 0, atrasadas: 0 });
      const x = mapa.get(b.cam);
      x.qtd += b.qtd;
      x.rms = x.rms.concat(b.rms);
      x.atrasadas += b.atrasadas || 0;
      if (b.documentos?.length) x.documentos = x.documentos.concat(b.documentos);
      else x.aLancar += b.qtd;
      x.forcado = x.forcado || b.forcado;
    });
    return Array.from(mapa.values());
  };

  const ordenar = (lista, campo) => lista.slice().sort((a, b) => {
    if (Boolean(a.forcado) !== Boolean(b.forcado)) return a.forcado ? -1 : 1;
    if (a[campo] && b[campo] && a[campo] !== b[campo]) return a[campo].localeCompare(b[campo]);
    return b.qtd - a.qtd;
  });

  const dentroDaSemana = (data) => Boolean(data) && data >= primeiroDia && data <= ultimoDia;

  const agenda = dias.map(dia => {
    const chegar = ordenar(mesclarPorCam(blocos.filter(b => b.chegouEm === dia)), 'prazo');
    const entregar = ordenar(mesclarPorCam([
      ...entregasProntas.filter(e => e.saiEm === dia),
      ...blocos.filter(b => b.tratamento === TRATAMENTOS.GTC && b.rota === dia)
    ]), 'saiEm');
    const atender = ordenar(mesclarPorCam(blocos.filter(b => b.tratamento === TRATAMENTOS.STC && b.prazo === dia)), 'prazo');
    return {
      dia,
      chegar, entregar, atender,
      total: chegar.reduce((t, b) => t + b.qtd, 0),
      temTrabalho: chegar.length + entregar.length + atender.length > 0
    };
  });

  // O que cai depois da semana programada não some: aparece junto, com
  // a data real, para a Expedição saber o que já está encomendado.
  const depois = {
    chegar: ordenar(mesclarPorCam(blocos.filter(b => !dentroDaSemana(b.chegouEm))), 'chegouEm'),
    entregar: ordenar(mesclarPorCam([
      ...entregasProntas.filter(e => !dentroDaSemana(e.saiEm)),
      ...blocos.filter(b => b.tratamento === TRATAMENTOS.GTC && b.rota && !dentroDaSemana(b.rota))
    ]), 'saiEm'),
    atender: ordenar(mesclarPorCam(blocos.filter(b => b.tratamento === TRATAMENTOS.STC && !dentroDaSemana(b.prazo))), 'prazo')
  };
  depois.temTrabalho = depois.chegar.length + depois.entregar.length + depois.atender.length > 0;

  return {
    hoje,
    agenda,
    depois,
    blocos,
    entregasProntas,
    temPlano: Boolean(snapshot),
    resumo: {
      total: itens.length,
      atrasadas: itens.filter(i => i.atrasada).length,
      doPlano: itens.filter(i => !i.atrasada).length,
      aEntregar: entregasProntas.reduce((t, e) => t + e.qtd, 0),
      foraDaSemana: blocos.filter(b => !dentroDaSemana(b.chegouEm)).reduce((t, b) => t + b.qtd, 0)
    }
  };
};
