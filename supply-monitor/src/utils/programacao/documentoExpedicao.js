import { criarDocumento, TINTA, SUAVE, AZUL, VERDE, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana, diasUteisDaSemana, somaDiasUteis } from './semana';
import { DIAS_EXPEDICAO, ESTADOS } from './expedicao';
import { rotaDescrita, TRATAMENTOS } from './rotas';

// -----------------------------------------------------------------------
// Documento da Expedição — a ordem de serviço da semana.
//
// Acompanha SÓ as RMs da programação da separação, do começo ao fim da
// linha: o que o depósito separou, a Expedição prontifica e, quando for
// GTC, expede. O que ficou de trás — STC antigas, documento parado
// esperando o CDAM — é tratado nas filas da tela, fora deste documento.
//
//   PRONTIFICAR — lançar a STC ou a GTC em todas as RMs do lote, dentro
//                 do prazo. A STC lançada está PRONTA: acabou.
//   ENTREGAR    — a GTC lançada ainda precisa do status EXPEDIDO, no
//                 dia da rota do cliente.
//
// Cada linha mostra onde o lote está agora, lido do WMS no momento da
// emissão. A mesma folha diz o que fazer e o que já foi feito.
// -----------------------------------------------------------------------

const nomeDoCam = (g) => (g.sigla && g.sigla !== g.cam ? `${g.sigla} — ${g.cam}` : g.cam);
const diaPorExtenso = (iso) => `${DIAS_SEMANA[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(iso)}`;

// Resume o andamento de um lote em texto curto, na ordem do processo.
const andamento = (b) => {
  const partes = [];
  if (b.naSeparacao) partes.push(`${b.naSeparacao} na separação`);
  if (b.aProntificar) partes.push(`${b.aProntificar} a prontificar`);
  if (b.prontas) partes.push(`${b.prontas} prontas`);
  if (b.aEntregar) partes.push(`${b.aEntregar} a expedir`);
  if (b.expedidas) partes.push(`${b.expedidas} expedidas`);
  return partes.join(' · ') || '—';
};

export const gerarPdfExpedicao = ({ projecao, semanaRef, programador, encarregado, versao, emitidoEm }) => {
  if (!projecao) throw new Error('Sem programação da Expedição para gerar o documento.');

  const dias = diasUteisDaSemana(semanaRef);
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

  // ── 1. Situação ───────────────────────────────────────────────────
  p.secao(num(), 'Situação da Programação');
  p.numeros([
    { rotulo: 'RMs programadas', valor: resumo.total },
    { rotulo: 'Na separação', valor: resumo.naSeparacao },
    { rotulo: 'A prontificar', valor: resumo.aProntificar, cor: resumo.aProntificar ? AMBAR : TINTA },
    { rotulo: 'STC prontas', valor: resumo.prontas, cor: resumo.prontas ? VERDE : TINTA },
    { rotulo: 'GTC a expedir', valor: resumo.aEntregar },
    { rotulo: 'Expedidas', valor: resumo.expedidas, cor: resumo.expedidas ? VERDE : TINTA }
  ]);
  p.paragrafo(
    'Este documento acompanha apenas as RMs da programação da separação desta semana, da conclusão no depósito até a '
    + 'saída. O material concluído num dia chega à Expedição no dia útil seguinte; a partir daí o prazo para lançar a '
    + `STC ou a GTC em todas as RMs do lote é de ${DIAS_EXPEDICAO} dias úteis, ou o prazo da mensagem quando houver, ou `
    + 'o dia da rota do cliente, o que vier primeiro. A STC lançada está pronta: acabou. A GTC lançada ainda precisa do '
    + 'status EXPEDIDO no dia da rota.'
    + (resumo.canceladas ? ` ${resumo.canceladas} RM(s) da programação foram canceladas e saíram da conta.` : '')
  );

  // ── 2. A grade da semana ──────────────────────────────────────────
  if (blocos.length > 0) {
    const porCamGrade = new Map();
    blocos.forEach(b => {
      if (!porCamGrade.has(b.cam)) {
        porCamGrade.set(b.cam, {
          cam: b.cam, sigla: b.sigla, tratamento: b.tratamento, doc: b.documentoEsperado,
          porDia: {}, total: 0, prazo: null, saiEm: null
        });
      }
      const l = porCamGrade.get(b.cam);
      l.porDia[b.chegouEm] = (l.porDia[b.chegouEm] || 0) + b.qtd;
      l.total += b.qtd;
      if (!l.prazo || b.prazo < l.prazo) l.prazo = b.prazo;
      const saida = b.rota || b.janela?.fim || null;
      if (saida && (!l.saiEm || saida < l.saiEm)) l.saiEm = saida;
    });

    const colunas = [
      { key: 'cam', label: 'CAM', largura: 0.26, forte: true },
      { key: 'doc', label: 'Doc.', largura: 0.055, align: 'center' },
      ...dias.map(d => ({ key: d, label: formatarCurto(d), largura: 0.064, align: 'center' })),
      { key: 'total', label: 'Total', largura: 0.055, align: 'center', forte: true },
      // Largura suficiente para a data inteira: 0,6 x 8pt x 10 caracteres
      // mais a folga da célula, senão o html quebra "29/10/202 / 6".
      { key: 'prazo', label: 'Prontificar até', largura: 0.155, align: 'center' },
      { key: 'saida', label: 'Sai em', largura: 0.155, align: 'right' }
    ];
    const linhasDe = (lista) => lista.map(l => ({
      cam: l.sigla && l.sigla !== l.cam ? `${l.sigla} — ${l.cam}` : l.cam,
      doc: l.doc,
      ...Object.fromEntries(dias.map(d => [d, l.porDia[d] || '—'])),
      total: l.total,
      prazo: l.prazo ? formatarBr(l.prazo) : '—',
      saida: l.saiEm ? formatarBr(l.saiEm) : '—'
    }));
    const montaLinhas = (tratamento) => Array.from(porCamGrade.values())
      .filter(l => (tratamento === 'OUTROS'
        ? l.tratamento !== TRATAMENTOS.GTC && l.tratamento !== TRATAMENTOS.STC
        : l.tratamento === tratamento))
      .sort((a, b) => b.total - a.total);

    p.secao(num(), 'Grade da Semana por CAM');
    p.paragrafo('Quanto material de cada cliente chega à Expedição em cada dia, qual documento precisa ser lançado, '
      + 'até quando, e quando sai. As colunas de dia são a CHEGADA na Expedição — um dia útil depois de a estocagem '
      + 'concluir.');
    [
      { titulo: 'GTC — entrega nossa', linhas: montaLinhas(TRATAMENTOS.GTC) },
      { titulo: 'STC — lançar e o CDAM retira', linhas: montaLinhas(TRATAMENTOS.STC) },
      { titulo: 'Sem rota cadastrada', linhas: montaLinhas('OUTROS') }
    ].filter(b => b.linhas.length > 0).forEach(b => p.tabela({
      titulo: b.titulo,
      colunas,
      linhas: linhasDe(b.linhas),
      rodape: {
        cam: 'TOTAL', doc: '',
        ...Object.fromEntries(dias.map(d => [d, b.linhas.reduce((t, l) => t + (l.porDia[d] || 0), 0) || '—'])),
        total: b.linhas.reduce((t, l) => t + l.total, 0),
        prazo: '', saida: ''
      }
    }));
  }

  // ── 3. A ordem de serviço, dia a dia ──────────────────────────────
  p.secao(num(), 'O Que Fazer em Cada Dia');
  p.paragrafo('PRONTIFICAR é lançar a STC ou a GTC em todas as RMs do lote que chegou — a conferência da Expedição. '
    + 'ENTREGAR são as GTC já lançadas que saem hoje pela rota do cliente e precisam fechar em EXPEDIDO. A coluna de '
    + 'andamento mostra onde o lote está agora, lido do sistema no momento da emissão.');

  const colunasProntificar = [
    { key: 'cam', label: 'CAM', largura: 0.30, forte: true },
    { key: 'doc', label: 'Lançar', largura: 0.07, align: 'center' },
    { key: 'rms', label: 'RMs', largura: 0.07, align: 'center' },
    { key: 'falta', label: 'Falta', largura: 0.07, align: 'center' },
    { key: 'prazo', label: 'Prontificar até', largura: 0.145, align: 'center' },
    { key: 'porque', label: 'Prazo que manda', largura: 0.185 },
    { key: 'andamento', label: 'Andamento', largura: 0.19 }
  ];
  const colunasEntregar = [
    { key: 'cam', label: 'CAM', largura: 0.34, forte: true },
    { key: 'rms', label: 'RMs', largura: 0.09, align: 'center' },
    { key: 'expedir', label: 'A expedir', largura: 0.12, align: 'center' },
    { key: 'andamento', label: 'Andamento', largura: 0.45 }
  ];

  const blocoDoDia = (d, rotulo, nota) => {
    if (!d.temTrabalho) return;
    p.reservar(30);
    p.texto(rotulo, { tamanho: 9.5, estilo: 'bold', cor: TINTA, espacoDepois: 0.8 });
    if (nota) p.texto(nota, { tamanho: 7.5, cor: SUAVE, espacoDepois: 1.5 });
    p.regua([203, 213, 225], 0.2, 2);

    if (d.prontificar.length > 0) {
      p.tabela({
        titulo: `Prontificar — lançar STC ou GTC  (${d.prontificar.reduce((t, b) => t + b.qtd, 0)} RM)`,
        colunas: colunasProntificar, espacoDepois: 3,
        linhas: d.prontificar.map(b => ({
          cam: nomeDoCam(b),
          doc: b.documentoEsperado,
          rms: b.qtd,
          falta: b.falta || '—',
          falta_cor: b.falta ? AMBAR : VERDE,
          prazo: formatarBr(b.prazo),
          porque: b.motivo,
          andamento: andamento(b)
        }))
      });
    }
    if (d.entregar.length > 0) {
      p.tabela({
        titulo: `Entregar — GTC que saem hoje  (${d.entregar.reduce((t, b) => t + b.qtd, 0)} RM)`,
        colunas: colunasEntregar, espacoDepois: 3,
        linhas: d.entregar.map(b => ({
          cam: nomeDoCam(b),
          rms: b.qtd,
          expedir: b.qtd - b.expedidas,
          andamento: andamento(b)
        }))
      });
    }
    p.y += 1.5;
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
        'Separado no fim da semana: chega e vence já na semana seguinte.');
    }
  }

  // ── 4. CAMs sem rota ──────────────────────────────────────────────
  const semRota = blocos.filter(b => b.tratamento !== TRATAMENTOS.GTC && b.tratamento !== TRATAMENTOS.STC);
  if (semRota.length > 0) {
    const porCamSemRota = new Map();
    semRota.forEach(b => porCamSemRota.set(b.cam, (porCamSemRota.get(b.cam) || 0) + b.qtd));
    p.secao(num(), 'CAMs sem Rota Cadastrada');
    p.paragrafo('Entram na programação mas ainda não foram classificados como entrega nossa ou retirada por terceiro. '
      + 'Sem isso não há documento esperado nem dia de saída: vale só o prazo de 3 dias úteis da Expedição.');
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

  // ── Anexo A: as RMs a prontificar, por CAM ────────────────────────
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
    p.paragrafo('Cada RM da programação, por cliente e por dia de chegada à Expedição, com a marca de onde ela está: '
      + 'sep = ainda na separação · (sem marca) = chegou e espera documento · stc = STC lançada, pronta · gtc = GTC '
      + 'lançada, falta expedir · exp = expedida. É a relação que se confere fisicamente na doca.');
    anexoA.forEach(c => {
      p.reservar(22);
      p.texto(`${c.sigla && c.sigla !== c.cam ? `${c.sigla} — ${c.cam}` : c.cam}  ·  ${c.total} RM(s)  ·  lançar ${c.doc}  ·  ${c.tratamento === TRATAMENTOS.GTC ? `entrega nossa, ${rotaDescrita(c.config)}` : c.tratamento === TRATAMENTOS.STC ? `o CDAM retira, ${rotaDescrita(c.config)}` : 'sem rota cadastrada'}`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 1.5);
      c.lotes.forEach(b => {
        p.reservar(14);
        p.texto(`Chegou em ${formatarBr(b.chegouEm)} · prontificar até ${formatarBr(b.prazo)} · ${b.qtd} RM(s) · ${andamento(b)}`,
          { tamanho: 8, estilo: 'bold', cor: AZUL, espacoDepois: 0.5 });
        p.gradeDeRms(b.rms.map(r => ({
          rm: r.rm,
          nota: r.estado === ESTADOS.NAO_CHEGOU ? 'sep'
            : r.estado === ESTADOS.PRONTA ? 'stc'
              : r.estado === ESTADOS.A_ENTREGAR ? 'gtc'
                : r.estado === ESTADOS.EXPEDIDA ? 'exp' : ''
        })));
      });
      p.y += 2;
    });
  }

  // ── Anexo B: o que já ganhou documento ────────────────────────────
  const documentos = new Map();
  blocos.forEach(b => b.rms.forEach(r => {
    if (r.estado !== ESTADOS.PRONTA && r.estado !== ESTADOS.A_ENTREGAR && r.estado !== ESTADOS.EXPEDIDA) return;
    const chave = String(r.documento || '').trim() || '(sem número)';
    if (!documentos.has(chave)) {
      documentos.set(chave, { documento: chave, cam: b.cam, sigla: b.sigla, tipo: r.tipoDoc || b.documentoEsperado, esperado: b.documentoEsperado, rms: [], expedidas: 0 });
    }
    const d = documentos.get(chave);
    d.rms.push(r);
    if (r.estado === ESTADOS.EXPEDIDA) d.expedidas++;
  }));
  const anexoB = Array.from(documentos.values()).sort((a, b) => {
    const faltaA = a.rms.length - a.expedidas;
    const faltaB = b.rms.length - b.expedidas;
    if ((faltaA > 0) !== (faltaB > 0)) return faltaA > 0 ? -1 : 1;
    return b.rms.length - a.rms.length;
  });

  if (anexoB.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO B — POR STC E GTC LANÇADAS NESTA SEMANA',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Os documentos que a Expedição já lançou sobre as RMs desta programação, com o cliente e as RMs que '
      + 'cada um carrega. A STC lançada está pronta; a GTC ainda precisa fechar em EXPEDIDO.');
    anexoB.forEach(d => {
      p.reservar(14);
      const falta = d.rms.length - d.expedidas;
      const estado = d.tipo === 'STC' ? 'STC lançada — pronta'
        : falta === 0 ? 'GTC expedida' : `GTC lançada — faltam ${falta} expedir`;
      // Documento de tipo diferente do que o CAM espera não é erro
      // automático — o Núcleo de Implantação é assim de propósito —,
      // mas precisa estar à vista de quem confere.
      const divergente = d.esperado && d.tipo && d.tipo !== d.esperado ? `  (cadastro espera ${d.esperado})` : '';
      p.texto(`${d.documento}   ${d.sigla}   ${d.rms.length} RM(s)   ${estado}${divergente}`,
        { tamanho: 8.5, estilo: 'bold', cor: falta === 0 || d.tipo === 'STC' ? VERDE : AZUL, espacoDepois: 0.5 });
      p.gradeDeRms(d.rms.map(r => ({ rm: r.rm, nota: r.estado === ESTADOS.EXPEDIDA ? 'exp' : '' })));
    });
  }

  const sufixo = versao ? `_${versao.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
  p.salvar(`Programacao_Expedicao_${semanaRef}${sufixo}.pdf`);
};
