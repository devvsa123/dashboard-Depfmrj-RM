import { criarDocumento, TINTA, SUAVE, AZUL, VERMELHO, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana, diasUteisDaSemana, somaDiasUteis } from './semana';
import { janelasDaSemana, DIAS_EXPEDICAO } from './expedicao';
import { rotaDescrita, TRATAMENTOS } from './rotas';

// -----------------------------------------------------------------------
// Documento da Expedição — a ordem de serviço da semana.
//
// Não é um retrato do que está parado: é a lista do que precisa ser
// feito, dia a dia, nas três etapas da linha de produção.
//
//   recebido  — o que a estocagem concluiu no dia útil anterior e chegou
//               hoje na Expedição, para montar mapa e lançar documento
//   entregar  — as GTC que saem hoje, pela rota do cliente
//   atender   — as STC cujo prazo vence hoje
//
// O prazo de cada bloco é o menor entre o prazo próprio da Expedição
// (3 dias úteis da chegada), o prazo da mensagem que originou a RM e a
// saída do CAM. O documento imprime qual deles mandou, porque é esse
// dia que vai ser cobrado.
//
// Aqui só aparecem CAM e quantidade. A relação das RMs fica nos anexos:
// o A para o que ainda não tem documento, o B por GTC ou STC.
// -----------------------------------------------------------------------

const nomeDoCam = (g) => (g.sigla && g.sigla !== g.cam ? `${g.sigla} — ${g.cam}` : g.cam);
const diaPorExtenso = (iso) => `${DIAS_SEMANA[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(iso)}`;

export const gerarPdfExpedicao = ({ filas, projecao, semanaRef, programador, encarregado, versao, emitidoEm }) => {
  if (!filas) throw new Error('Sem dados da Expedição para gerar o documento.');

  const dias = diasUteisDaSemana(semanaRef);
  const janelas = janelasDaSemana(filas, dias[0], dias[dias.length - 1]);
  const { resumo } = filas;
  const blocos = projecao?.blocos || [];

  // Só o que já passou do verde entra na cobrança: listar o que está no
  // prazo encheria páginas de linha sem ação.
  const cobrar = filas.cobranca.filter(d => d.nivel.key !== 'verde');

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

  // ── 1. Situação ───────────────────────────────────────────────────
  p.secao(num(), 'Situação da Expedição');
  p.numeros([
    { rotulo: 'A prontificar', valor: resumo.aProntificar },
    { rotulo: 'GTC a entregar', valor: resumo.gtcAEntregar },
    { rotulo: 'Aguardando retirada', valor: resumo.stcACobrar },
    { rotulo: 'Paradas +15 dias', valor: resumo.vermelhos, cor: resumo.vermelhos ? VERMELHO : TINTA },
    { rotulo: 'CAMs a fechar', valor: resumo.camsAFechar }
  ]);
  p.paragrafo(
    `O material concluído pela estocagem num dia chega à Expedição no dia útil seguinte. A partir daí o prazo para `
    + `montar o mapa e lançar o documento é de ${DIAS_EXPEDICAO} dias úteis para RM comum, ou o prazo da mensagem `
    + 'quando houver — e, nos dois casos, nunca depois da saída do CAM. A seção 3 traz, dia a dia, o que entra, o que '
    + `sai e o que vence. Há ainda ${resumo.stcACobrar} RM(s) com documento já lançado, que dependem apenas da `
    + `retirada${resumo.vermelhos > 0 ? `, sendo ${resumo.vermelhos} paradas há mais de 15 dias` : ''}.`
  );

  // ── 2. A grade da semana ──────────────────────────────────────────
  if (blocos.length > 0) {
    const porCamGrade = new Map();
    blocos.forEach(b => {
      if (!porCamGrade.has(b.cam)) {
        porCamGrade.set(b.cam, { cam: b.cam, sigla: b.sigla, tratamento: b.tratamento, porDia: {}, total: 0, prazo: null, saiEm: null });
      }
      const l = porCamGrade.get(b.cam);
      l.porDia[b.chegouEm] = (l.porDia[b.chegouEm] || 0) + b.qtd;
      l.total += b.qtd;
      if (!l.prazo || b.prazo < l.prazo) l.prazo = b.prazo;
      if (b.saiEm && (!l.saiEm || b.saiEm < l.saiEm)) l.saiEm = b.saiEm;
    });

    const montaLinhas = (tratamento) => Array.from(porCamGrade.values())
      .filter(l => (tratamento === 'OUTROS'
        ? l.tratamento !== TRATAMENTOS.GTC && l.tratamento !== TRATAMENTOS.STC
        : l.tratamento === tratamento))
      .sort((a, b) => b.total - a.total);

    const colunas = [
      { key: 'cam', label: 'CAM', largura: 0.28, forte: true },
      ...dias.map(d => ({ key: d, label: formatarCurto(d), largura: 0.077, align: 'center' })),
      { key: 'total', label: 'Total', largura: 0.07, align: 'center', forte: true },
      { key: 'prazo', label: 'Prontificar até', largura: 0.145, align: 'center' },
      { key: 'saida', label: 'Sai em', largura: 0.12, align: 'right' }
    ];
    const linhasDe = (lista) => lista.map(l => ({
      cam: l.sigla && l.sigla !== l.cam ? `${l.sigla} — ${l.cam}` : l.cam,
      ...Object.fromEntries(dias.map(d => [d, l.porDia[d] || '—'])),
      total: l.total,
      prazo: l.prazo ? formatarBr(l.prazo) : '—',
      saida: l.saiEm ? formatarBr(l.saiEm) : '—'
    }));

    p.secao(num(), 'Grade da Semana por CAM');
    p.paragrafo('Quanto material de cada cliente chega à Expedição em cada dia, até quando precisa estar prontificado e '
      + 'quando sai. As colunas de dia são a CHEGADA na Expedição — um dia útil depois de a estocagem concluir.');
    [
      { titulo: 'GTC — entrega nossa', linhas: montaLinhas(TRATAMENTOS.GTC) },
      { titulo: 'STC — lançar e aguardar o CDAM', linhas: montaLinhas(TRATAMENTOS.STC) },
      { titulo: 'Sem rota cadastrada', linhas: montaLinhas('OUTROS') }
    ].filter(b => b.linhas.length > 0).forEach(b => p.tabela({
      titulo: b.titulo,
      colunas,
      linhas: linhasDe(b.linhas),
      rodape: {
        cam: 'TOTAL',
        ...Object.fromEntries(dias.map(d => [d, b.linhas.reduce((t, l) => t + (l.porDia[d] || 0), 0) || '—'])),
        total: b.linhas.reduce((t, l) => t + l.total, 0),
        prazo: '', saida: ''
      }
    }));
  }

  // ── 3. A ordem de serviço, dia a dia ──────────────────────────────
  p.secao(num(), 'O Que Fazer em Cada Dia');
  p.paragrafo('Três etapas em cada dia. RECEBIDO é o que a estocagem concluiu no dia útil anterior e chegou agora: '
    + 'montar o mapa de carregamento e lançar o documento até o prazo indicado. ENTREGAR são as GTC que saem hoje pela '
    + 'rota do cliente. ATENDER são as STC cujo prazo vence hoje — é este dia que será cobrado da Expedição.');

  const colunasRecebido = [
    { key: 'cam', label: 'CAM', largura: 0.38, forte: true },
    { key: 'rms', label: 'RMs', largura: 0.09, align: 'center' },
    { key: 'atraso', label: 'Atrasadas', largura: 0.11, align: 'center' },
    { key: 'prazo', label: 'Prontificar até', largura: 0.17, align: 'center' },
    { key: 'porque', label: 'Prazo que manda', largura: 0.25 }
  ];
  const colunasEntregar = [
    { key: 'cam', label: 'CAM', largura: 0.32, forte: true },
    { key: 'doc', label: 'Documento', largura: 0.40 },
    { key: 'rms', label: 'RMs', largura: 0.12, align: 'center' },
    { key: 'situacao', label: 'Situação', largura: 0.16, align: 'right' }
  ];
  const colunasAtender = [
    { key: 'cam', label: 'CAM', largura: 0.32, forte: true },
    { key: 'rms', label: 'RMs', largura: 0.10, align: 'center' },
    { key: 'janela', label: 'Janela do CDAM', largura: 0.22, align: 'center' },
    { key: 'porque', label: 'Prazo que manda', largura: 0.36 }
  ];

  const blocoDoDia = (d, rotulo, nota) => {
    if (!d.temTrabalho) return;
    p.reservar(30);
    p.texto(rotulo, { tamanho: 9.5, estilo: 'bold', cor: TINTA, espacoDepois: 0.8 });
    if (nota) p.texto(nota, { tamanho: 7.5, cor: SUAVE, espacoDepois: 1.5 });
    p.regua([203, 213, 225], 0.2, 2);

    if (d.chegar.length > 0) {
      p.tabela({
        titulo: `Recebido da estocagem — prontificar  (${d.chegar.reduce((t, b) => t + b.qtd, 0)} RM)`,
        colunas: colunasRecebido, espacoDepois: 3,
        linhas: d.chegar.map(b => ({
          cam: nomeDoCam(b),
          rms: b.qtd,
          atraso: b.atrasadas || '—',
          prazo: formatarBr(b.prazo),
          porque: b.motivo
        }))
      });
    }
    if (d.entregar.length > 0) {
      p.tabela({
        titulo: `Entregar — GTC que saem  (${d.entregar.reduce((t, b) => t + b.qtd, 0)} RM)`,
        colunas: colunasEntregar, espacoDepois: 3,
        linhas: d.entregar.map(b => ({
          cam: nomeDoCam(b),
          // Vinte e cinco números de GTC numa célula não se lê: os
          // primeiros dão o reconhecimento, o resto está no Anexo B.
          doc: (() => {
            const lancados = b.documentos?.length
              ? (b.documentos.length <= 3
                ? b.documentos.map(x => x.documento).join(', ')
                : `${b.documentos.slice(0, 2).map(x => x.documento).join(', ')} e mais ${b.documentos.length - 2} — ver Anexo B`)
              : '';
            const falta = b.aLancar ? `${b.aLancar} RM a lançar antes da saída` : '';
            return [lancados, falta].filter(Boolean).join(' · ') || 'a lançar antes da saída';
          })(),
          rms: b.qtd,
          situacao: b.aLancar && b.documentos?.length ? 'parcial'
            : b.documentos?.length ? 'lançada' : 'a prontificar'
        }))
      });
    }
    if (d.atender.length > 0) {
      p.tabela({
        titulo: `Atender — STC que vencem hoje  (${d.atender.reduce((t, b) => t + b.qtd, 0)} RM)`,
        colunas: colunasAtender, espacoDepois: 3,
        linhas: d.atender.map(b => ({
          cam: nomeDoCam(b),
          rms: b.qtd,
          janela: b.janela ? `${formatarCurto(b.janela.inicio)} a ${formatarCurto(b.janela.fim)}` : rotaDescrita(b.config),
          porque: b.motivo
        }))
      });
    }
    p.y += 1.5;
  };

  const temAlgo = (projecao?.agenda || []).some(d => d.temTrabalho);
  if (!temAlgo && !projecao?.depois?.temTrabalho) {
    p.paragrafo('Nada a fazer nesta semana.', { estilo: 'italic' });
  } else {
    (projecao?.agenda || []).forEach(d => blocoDoDia(
      d,
      diaPorExtenso(d.dia),
      `Recebe o que a estocagem concluiu em ${formatarBr(somaDiasUteis(d.dia, -1))}.`
    ));
    if (projecao?.depois?.temTrabalho) {
      blocoDoDia({ ...projecao.depois, temTrabalho: true }, 'Depois desta semana',
        'Já encomendado pela programação, com as datas reais de chegada e de saída.');
    }
  }

  // ── 4. Janelas ────────────────────────────────────────────────────
  p.secao(num(), 'Fechamento das STC por Janela do CDAM');
  p.paragrafo('Para cada CAM, o processo só fecha quando a STC está lançada em todas as RM não canceladas. "Faltam" é o '
    + 'que ainda está conferido sem documento; a coluna seguinte mostra o que ainda depende da separação e entrará '
    + 'depois. A ordem é a do fechamento da janela.');
  if (janelas.length === 0) {
    p.paragrafo('Nenhum CAM de STC com pendência.', { estilo: 'italic' });
  } else {
    p.tabela({
      colunas: [
        { key: 'cam', label: 'CAM', largura: 0.34, forte: true },
        { key: 'janela', label: 'Janela do CDAM', largura: 0.20, align: 'center' },
        { key: 'faltam', label: 'Faltam lançar', largura: 0.15, align: 'center' },
        { key: 'separacao', label: 'Na separação', largura: 0.14, align: 'center' },
        { key: 'lancadas', label: 'Já lançadas', largura: 0.17, align: 'right' }
      ],
      linhas: janelas.map(g => ({
        cam: `${nomeDoCam(g)}${g.nestaSemana ? ' (janela nesta semana)' : ''}`,
        janela: g.janela ? `${formatarCurto(g.janela.inicio)} a ${formatarCurto(g.janela.fim)}` : rotaDescrita(g.config),
        faltam: g.faltamFechar || '—',
        separacao: g.naSeparacao || '—',
        lancadas: g.inseridas.length || '—'
      })),
      rodape: {
        cam: 'TOTAL', janela: '',
        faltam: janelas.reduce((t, g) => t + g.faltamFechar, 0),
        separacao: janelas.reduce((t, g) => t + g.naSeparacao, 0),
        lancadas: janelas.reduce((t, g) => t + g.inseridas.length, 0)
      }
    });
  }

  // ── 5. Cobrança ───────────────────────────────────────────────────
  if (cobrar.length > 0) {
    p.secao(num(), 'Pendências de Retirada — Cobrar o CDAM');
    p.paragrafo('Documentos já lançados, com o material pronto e sem retirada. Não dependem da Expedição: o que cabe '
      + 'aqui é cobrar. Até 7 dias a situação é normal; de 8 a 15 dias cabe aviso; acima de 15 dias cabe cobrança formal.');
    p.tabela({
      colunas: [
        { key: 'doc', label: 'Documento', largura: 0.20, forte: true },
        { key: 'cam', label: 'CAM', largura: 0.38 },
        { key: 'rms', label: 'RMs', largura: 0.10, align: 'center' },
        { key: 'desde', label: 'Pronto desde', largura: 0.17, align: 'center' },
        { key: 'dias', label: 'Parado', largura: 0.15, align: 'right' }
      ],
      linhas: cobrar.map(d => ({
        doc: d.documento,
        cam: d.sigla === d.cam ? d.cam : `${d.sigla} — ${d.cam}`,
        rms: d.qtd,
        desde: d.desde ? formatarBr(d.desde) : '—',
        dias: `${d.dias} dias${d.nivel.key === 'vermelho' ? ' *' : ''}`,
        dias_cor: d.nivel.key === 'vermelho' ? VERMELHO : AMBAR
      })),
      rodape: { doc: 'TOTAL', cam: '', rms: cobrar.reduce((t, d) => t + d.qtd, 0), desde: '', dias: '' }
    });
    p.texto('* acima de 15 dias parados — cobrança formal ao CDAM.', { tamanho: 7, cor: SUAVE, espacoDepois: 4 });
  }

  // ── 6. Sem rota ───────────────────────────────────────────────────
  if (filas.semCadastro.length > 0) {
    p.secao(num(), 'CAMs sem Rota Cadastrada');
    p.paragrafo('Têm material na Expedição mas ainda não foram classificados como entrega nossa ou retirada por '
      + 'terceiro. Sem isso não há saída nem prazo de rota: valem só os dias de prazo da Expedição.');
    p.tabela({
      colunas: [
        { key: 'cam', label: 'CAM', largura: 0.62, forte: true },
        { key: 'rms', label: 'RMs paradas', largura: 0.20, align: 'center' },
        { key: 'espera', label: 'Mais antiga', largura: 0.18, align: 'right' }
      ],
      linhas: filas.semCadastro.map(g => ({
        cam: g.cam,
        rms: g.aProntificar.length + g.aEntregar.length,
        espera: g.maisAntiga != null ? `${g.maisAntiga} dias` : '—'
      }))
    });
  }

  p.assinaturas([
    { nome: programador, papel: 'Programador do DepFMRJ' },
    { nome: encarregado, papel: 'Encarregado do Abastecimento' }
  ]);

  // ── Anexo A: o que ainda não tem documento ────────────────────────
  const porCamAnexo = new Map();
  blocos.forEach(b => {
    if (!porCamAnexo.has(b.cam)) porCamAnexo.set(b.cam, { cam: b.cam, sigla: b.sigla, config: b.config, tratamento: b.tratamento, entradas: [], total: 0 });
    const l = porCamAnexo.get(b.cam);
    l.entradas.push(b);
    l.total += b.qtd;
  });
  const anexoA = Array.from(porCamAnexo.values()).sort((a, b) => b.total - a.total);

  if (anexoA.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO A — A PRONTIFICAR, POR CAM',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('O material que ainda não tem GTC nem STC, detalhado por cliente e por dia de chegada à Expedição. '
      + 'É a relação que se confere fisicamente na doca contra o que a seção 3 manda prontificar.');
    anexoA.forEach(c => {
      p.reservar(22);
      p.texto(`${c.sigla && c.sigla !== c.cam ? `${c.sigla} — ${c.cam}` : c.cam}  ·  ${c.total} RM(s)  ·  ${c.tratamento === TRATAMENTOS.GTC ? `entrega nossa, ${rotaDescrita(c.config)}` : c.tratamento === TRATAMENTOS.STC ? `retirada por terceiro, ${rotaDescrita(c.config)}` : 'sem rota cadastrada'}`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 1.5);
      c.entradas.forEach(b => {
        p.reservar(14);
        p.texto(`Chegou em ${formatarBr(b.chegouEm)} · prontificar até ${formatarBr(b.prazo)} · ${b.qtd} RM(s)`,
          { tamanho: 8, estilo: 'bold', cor: AZUL, espacoDepois: 0.5 });
        p.gradeDeRms(b.rms.map(l => ({ rm: l.rm, nota: l.atrasada ? 'atr.' : '' })));
      });
      p.y += 2;
    });
  }

  // ── Anexo B: o que já tem documento ───────────────────────────────
  const documentos = [];
  (filas.grupos || []).forEach(g => {
    const porDoc = new Map();
    [...g.aEntregar.map(l => ({ ...l, estado: 'a entregar' })),
     ...g.inseridas.map(l => ({ ...l, estado: 'aguardando retirada' }))].forEach(l => {
      const chave = String(l.documento || '').trim() || '(sem número)';
      if (!porDoc.has(chave)) porDoc.set(chave, { documento: chave, tipo: l.tipoDoc, cam: g.cam, sigla: g.config.sigla || g.cam, estado: l.estado, rms: [], dias: 0 });
      const d = porDoc.get(chave);
      d.rms.push(l);
      if ((l.dias ?? 0) > d.dias) d.dias = l.dias ?? 0;
    });
    porDoc.forEach(d => documentos.push(d));
  });
  // Primeiro o que depende de nós, depois o que depende do CDAM; dentro
  // de cada grupo, o que está parado há mais tempo.
  documentos.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'a entregar' ? -1 : 1;
    return b.dias - a.dias;
  });

  if (documentos.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO B — POR GTC E STC JÁ LANÇADAS',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Cada documento já lançado, com o cliente e as RMs que ele carrega. As de "a entregar" são entrega '
      + 'nossa e dependem da rota; as de "aguardando retirada" estão prontas e dependem do CDAM.');
    documentos.forEach(d => {
      p.reservar(14);
      const cor = d.estado === 'a entregar' ? AZUL : (d.dias > 15 ? VERMELHO : AMBAR);
      p.texto(`${d.documento}   ${d.tipo || ''}   ${d.sigla}   ${d.rms.length} RM(s)   ${d.estado}${d.dias > 0 ? ` · pronta há ${d.dias} dias` : ''}`,
        { tamanho: 8.5, estilo: 'bold', cor, espacoDepois: 0.5 });
      p.gradeDeRms(d.rms.map(l => ({ rm: l.rm })));
    });
  }

  const sufixo = versao ? `_${versao.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
  p.salvar(`Programacao_Expedicao_${semanaRef}${sufixo}.pdf`);
};
