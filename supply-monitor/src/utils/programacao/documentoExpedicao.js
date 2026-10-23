import { criarDocumento, TINTA, SUAVE, AZUL, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, rotuloSemana, somaDiasUteis } from './semana';
import { DIAS_EXPEDICAO, ACOES } from './expedicao';
import { rotaDescrita, TRATAMENTOS } from './rotas';
import { sufixoDeArquivo } from './versoes';

// -----------------------------------------------------------------------
// Documento da Expedição — a ordem de serviço da semana.
//
// É só o que fazer, e por dia. Acompanhamento não entra: para saber o
// que já foi feito existe a aba Andamento, que lê o WMS ao vivo. Um
// documento assinado é uma ordem, não um painel.
//
// Uma linha por CAM por dia, com a AÇÃO escrita:
//
//   Prontificar             lançar a STC ou a GTC em todas as RMs do lote
//   Prontificar e entregar  o lote chega e a rota do cliente é hoje
//   Entregar                já foi prontificado; hoje o caminhão sai
//
// Dois prazos distintos, de propósito. PRONTIFICAR tem prazo próprio —
// 3 dias úteis da chegada, ou o prazo da mensagem numa RM prioritária.
// ENTREGAR tem o dia da rota. A rota não encurta o prazo de
// prontificação: são trabalhos diferentes e cada um responde pelo seu.
// -----------------------------------------------------------------------

const nomeDoCam = (g) => (g.sigla && g.sigla !== g.cam ? `${g.sigla} — ${g.cam}` : g.cam);
const diaPorExtenso = (iso) => `${DIAS_SEMANA[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(iso)}`;

// O que vem depois de prontificar: entregar num dia, ou esperar o CDAM
// dentro da janela. Em "sai em" a STC nunca entra — ninguém sabe quando
// o CDAM vem buscar; o que se sabe é até quando ela pode ser aprovada.
const proximoPasso = (b, dia) => {
  // "hoje" só faz sentido dentro de uma tabela com data no título; no
  // bloco do que fica para depois, a data vai escrita.
  if (b.acao === ACOES.PRONTIFICAR_E_ENTREGAR || b.acao === ACOES.ENTREGAR) {
    return dia && b.entregarEm === dia ? 'Entregar hoje' : `Entregar em ${formatarBr(b.entregarEm)}`;
  }
  if (b.entregarEm) return `Entregar em ${formatarBr(b.entregarEm)}`;
  if (b.janela) return `Aprovar STC até ${formatarBr(b.janela.fim)}`;
  return '—';
};

export const gerarPdfExpedicao = ({ projecao, semanaRef, programador, encarregado, versao, emitidoEm }) => {
  if (!projecao) throw new Error('Sem programação da Expedição para gerar o documento.');

  const { resumo, blocos } = projecao;

  const p = criarDocumento({
    rodape: `DepFMRJ — Programação da Expedição — ${rotuloSemana(semanaRef)}${versao ? ` — ${versao}` : ''} — emitido em ${emitidoEm}`
  });

  p.cabecalho({
    orgao: 'Marinha do Brasil',
    unidade: 'Depósito de Fardamento da Marinha no Rio de Janeiro',
    titulo: 'PROGRAMAÇÃO DA EXPEDIÇÃO',
    subtitulo: `Semana de ${rotuloSemana(semanaRef)}`,
    selo: versao ? `${versao} · emitido em ${emitidoEm}` : `Emitido em ${emitidoEm}`
  });

  let n = 0;
  const num = () => String(++n);

  // ── 1. O que a semana traz ────────────────────────────────────────
  p.secao(num(), 'O Que a Semana Traz');
  p.numeros([
    { rotulo: 'RMs programadas', valor: resumo.total },
    { rotulo: 'Clientes', valor: resumo.cams },
    { rotulo: 'A lançar GTC', valor: resumo.gtc },
    { rotulo: 'A lançar STC', valor: resumo.stc },
    { rotulo: 'Entregas na semana', valor: resumo.entregas }
  ]);
  p.paragrafo(
    'O material concluído pela estocagem num dia chega à Expedição no dia útil seguinte. A partir daí o prazo para '
    + `PRONTIFICAR — deixar todas as RMs do lote com o número da STC ou da GTC — é de ${DIAS_EXPEDICAO} dias úteis, ou o `
    + 'prazo da mensagem nas RMs prioritárias. ENTREGAR é outro trabalho, com data própria: o dia da rota do cliente, '
    + 'quando a GTC fecha em EXPEDIDO. A STC lançada está pronta; o que vem depois é a retirada pelo CDAM, dentro da '
    + 'janela dele.'
  );
  // Nada de estado de pedido aqui, de propósito: na hora em que o
  // documento é assinado tudo está em processamento, e o que já andou se
  // vê na aba Andamento, que lê o WMS ao vivo. O documento traz prazo.
  p.paragrafo('Este documento traz prazos, não andamento: na emissão todas as RMs estão em processamento. '
    + 'O acompanhamento do que já foi prontificado e entregue fica na aba Andamento, que lê o WMS ao vivo.',
    { cor: SUAVE, tamanho: 7.5 });

  // ── 2. Índice da semana ───────────────────────────────────────────
  if (blocos.length > 0) {
    const porCamIndice = new Map();
    blocos.forEach(b => {
      if (!porCamIndice.has(b.cam)) {
        porCamIndice.set(b.cam, {
          cam: b.cam, sigla: b.sigla, tratamento: b.tratamento, doc: b.documentoEsperado,
          qtd: 0, chegada: null, prazo: null, entregarEm: null, janela: b.janela
        });
      }
      const l = porCamIndice.get(b.cam);
      l.qtd += b.qtd;
      if (!l.chegada || b.chegouEm < l.chegada) l.chegada = b.chegouEm;
      if (!l.prazo || b.prazo < l.prazo) l.prazo = b.prazo;
      if (b.entregarEm && (!l.entregarEm || b.entregarEm < l.entregarEm)) l.entregarEm = b.entregarEm;
    });

    const montaLinhas = (tratamento) => Array.from(porCamIndice.values())
      .filter(l => (tratamento === 'OUTROS'
        ? l.tratamento !== TRATAMENTOS.GTC && l.tratamento !== TRATAMENTOS.STC
        : l.tratamento === tratamento))
      .sort((a, b) => b.qtd - a.qtd);

    p.secao(num(), 'Índice da Semana por Cliente');
    p.paragrafo('Os prazos de cada cliente nesta semana, para achar rápido: quando o lote chega, até quando '
      + 'prontificar e quando sai. O detalhe do que fazer em cada dia vem na seção seguinte.');
    [
      { titulo: 'GTC — entrega nossa', linhas: montaLinhas(TRATAMENTOS.GTC), ultima: 'Entregar em' },
      { titulo: 'STC — lançar e o CDAM retira', linhas: montaLinhas(TRATAMENTOS.STC), ultima: 'Aprovar STC até' },
      { titulo: 'Sem rota cadastrada', linhas: montaLinhas('OUTROS'), ultima: 'Saída' }
    ].filter(b => b.linhas.length > 0).forEach(b => p.tabela({
      titulo: b.titulo,
      colunas: [
        { key: 'cam', label: 'CAM', largura: 0.36, forte: true },
        { key: 'doc', label: 'Doc.', largura: 0.07, align: 'center' },
        { key: 'qtd', label: 'RMs', largura: 0.08, align: 'center', forte: true },
        { key: 'chegada', label: 'Chega em', largura: 0.15, align: 'center' },
        { key: 'prazo', label: 'Prontificar até', largura: 0.17, align: 'center' },
        { key: 'saida', label: b.ultima, largura: 0.17, align: 'right' }
      ],
      linhas: b.linhas.map(l => {
        const saida = l.entregarEm || l.janela?.fim || null;
        return {
          cam: l.sigla && l.sigla !== l.cam ? `${l.sigla} — ${l.cam}` : l.cam,
          doc: l.doc,
          qtd: l.qtd,
          chegada: l.chegada ? formatarBr(l.chegada) : '—',
          prazo: l.prazo ? formatarBr(l.prazo) : '—',
          saida: saida ? formatarBr(saida) : '—',
          // Janela fechando antes do prazo de prontificação: ali manda a
          // janela, não o prazo.
          saida_cor: !l.entregarEm && saida && l.prazo && saida < l.prazo ? AMBAR : undefined
        };
      }),
      rodape: { cam: 'TOTAL', doc: '', qtd: b.linhas.reduce((t, l) => t + l.qtd, 0), chegada: '', prazo: '', saida: '' }
    }));
  }

  // ── 3. A ordem de serviço, dia a dia ──────────────────────────────
  p.secao(num(), 'O Que Fazer em Cada Dia');
  p.paragrafo('Uma linha por cliente. PRONTIFICAR é lançar a STC ou a GTC em todas as RMs do lote que chegou. '
    + 'ENTREGAR é fechar a GTC em EXPEDIDO, no dia da rota. Quando os dois caem no mesmo dia, a linha diz '
    + '"Prontificar e entregar". A relação das RMs, na ordem de liberação do WMS, está no Anexo A.');
  // O prazo de prontificação do lote é o da coluna, sempre. Mas numa
  // linha que também entrega no mesmo dia, a GTC tem de estar lançada
  // antes de o caminhão sair — senão o material vai sem documento.
  p.paragrafo('Nas linhas "Prontificar e entregar", o prazo da coluna é o do lote, mas a GTC precisa estar lançada antes '
    + 'de o caminhão sair: o que embarca naquele dia tem de estar com documento no sistema.', { cor: SUAVE, tamanho: 7.5 });

  const colunasDoDia = [
    { key: 'cam', label: 'CAM', largura: 0.28, forte: true },
    { key: 'acao', label: 'Ação', largura: 0.20 },
    { key: 'doc', label: 'Doc.', largura: 0.06, align: 'center' },
    { key: 'rms', label: 'RMs', largura: 0.07, align: 'center' },
    { key: 'prazo', label: 'Prontificar até', largura: 0.155, align: 'center' },
    { key: 'passo', label: 'Próximo passo', largura: 0.235, align: 'right' }
  ];

  const linhasDaAgenda = (linhas, dia) => linhas.map(b => ({
    cam: nomeDoCam(b),
    acao: b.acao.label,
    acao_cor: b.acao === ACOES.ENTREGAR ? AZUL : undefined,
    doc: b.documentoEsperado,
    rms: b.qtd,
    prazo: b.acao === ACOES.ENTREGAR ? '—' : formatarBr(b.prazo),
    passo: proximoPasso(b, dia)
  }));

  const blocoDoDia = (d, rotulo, nota) => {
    if (!d.temTrabalho) return;
    p.reservar(28);
    p.texto(rotulo, { tamanho: 9.5, estilo: 'bold', cor: TINTA, espacoDepois: 0.8 });
    if (nota) p.texto(nota, { tamanho: 7.5, cor: SUAVE, espacoDepois: 1.5 });
    p.tabela({
      colunas: colunasDoDia,
      linhas: linhasDaAgenda(d.linhas, d.dia),
      rodape: { cam: d.dia ? 'TOTAL DO DIA' : 'TOTAL', acao: '', doc: '', rms: d.linhas.reduce((t, b) => t + b.qtd, 0), prazo: '', passo: '' },
      espacoDepois: 4
    });
  };

  const temAlgo = (projecao.agenda || []).some(d => d.temTrabalho);
  if (!temAlgo && !projecao.depois?.temTrabalho) {
    p.paragrafo('Nada a fazer nesta semana.', { estilo: 'italic' });
  } else {
    (projecao.agenda || []).forEach(d => blocoDoDia(
      d,
      diaPorExtenso(d.dia),
      `Recebe o que a estocagem concluiu em ${formatarBr(somaDiasUteis(d.dia, -1))}.`
    ));
    if (projecao.depois?.temTrabalho) {
      blocoDoDia({ ...projecao.depois, temTrabalho: true }, 'Depois desta semana',
        'Separado no fim da semana ou com rota na semana seguinte.');
    }
  }

  // ── 4. CAMs sem rota ──────────────────────────────────────────────
  const semRota = blocos.filter(b => b.tratamento !== TRATAMENTOS.GTC && b.tratamento !== TRATAMENTOS.STC);
  if (semRota.length > 0) {
    const porCamSemRota = new Map();
    semRota.forEach(b => porCamSemRota.set(b.cam, (porCamSemRota.get(b.cam) || 0) + b.qtd));
    p.secao(num(), 'CAMs sem Rota Cadastrada');
    p.paragrafo('Entram na programação mas ainda não foram classificados como entrega nossa ou retirada por terceiro. '
      + 'Sem isso não há documento esperado nem dia de saída: vale só o prazo de prontificação.');
    p.tabela({
      colunas: [
        { key: 'cam', label: 'CAM', largura: 0.75, forte: true },
        { key: 'rms', label: 'RMs na semana', largura: 0.25, align: 'right' }
      ],
      linhas: Array.from(porCamSemRota.entries()).sort((a, b) => b[1] - a[1]).map(([cam, qtd]) => ({ cam, rms: qtd }))
    });
  }

  p.assinaturas([
    { nome: programador, papel: 'Programador do DepFMRJ' },
    { nome: encarregado, papel: 'Encarregado do Abastecimento' }
  ]);

  // ── Anexo A: as RMs, na ordem de liberação ────────────────────────
  const porCamAnexo = new Map();
  blocos.forEach(b => {
    if (!porCamAnexo.has(b.cam)) {
      porCamAnexo.set(b.cam, { cam: b.cam, sigla: b.sigla, config: b.config, tratamento: b.tratamento, doc: b.documentoEsperado, lotes: [], total: 0 });
    }
    const l = porCamAnexo.get(b.cam);
    l.lotes.push(b);
    l.total += b.qtd;
  });
  const anexoA = Array.from(porCamAnexo.values()).sort((a, b) => b.total - a.total);

  if (anexoA.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO A — AS RMS DA SEMANA, POR CAM',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Cada RM da programação, por cliente e por dia de chegada à Expedição, com a data de liberação ao '
      + 'lado. A ordem é a da liberação, mais antiga primeiro — a mesma do WMS, para o manuseio da reserva seguir a '
      + 'lista de cima para baixo.');
    anexoA.forEach(c => {
      p.reservar(22);
      p.texto(`${c.sigla && c.sigla !== c.cam ? `${c.sigla} — ${c.cam}` : c.cam}  ·  ${c.total} RM(s)  ·  lançar ${c.doc}  ·  ${c.tratamento === TRATAMENTOS.GTC ? `entrega nossa, ${rotaDescrita(c.config)}` : c.tratamento === TRATAMENTOS.STC ? `o CDAM retira, ${rotaDescrita(c.config)}` : 'sem rota cadastrada'}`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 1.5);
      c.lotes.forEach(b => {
        p.reservar(14);
        p.texto(`Chega em ${formatarBr(b.chegouEm)} · prontificar até ${formatarBr(b.prazo)} · ${b.qtd} RM(s)`,
          { tamanho: 8, estilo: 'bold', cor: AZUL, espacoDepois: 0.5 });
        p.gradeDeRms(b.rms.map(r => ({ rm: r.rm, nota: r.entrada ? formatarBr(r.entrada).slice(0, 5) : '' })), { colunas: 5 });
      });
      p.y += 2;
    });
  }

  const sufixo = versao ? `_${sufixoDeArquivo(versao)}` : '';
  p.salvar(`Programacao_Expedicao_${semanaRef}${sufixo}.pdf`);
};
