import { criarDocumento, TINTA, SUAVE, VERMELHO, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana } from './semana';
import { ORIGENS, limiteDeSeparacao } from './motor';
import { agruparParaAnexo } from './versoes';

// -----------------------------------------------------------------------
// Documento da programação semanal da separação. Escrito como texto pelo
// mesmo motor do documento da Expedição (ver pdfTexto.js): o Anexo A
// lista cada RM programada da semana e cresce com a vazão do depósito —
// em raster ele ia bater no teto de canvas do navegador do mesmo jeito,
// só um pouco mais tarde.
// -----------------------------------------------------------------------

const ORIGEM_LABEL = Object.fromEntries(ORIGENS.map(o => [o.key, o.label]));
ORIGEM_LABEL.FORCADO = 'Forçado pelo programador';
// ANTIGUIDADE é o nome antigo de FILA. Versões publicadas antes da
// mudança continuam no banco e precisam sair no documento do mesmo jeito.
ORIGEM_LABEL.ANTIGUIDADE = 'Fila por antiguidade';
ORIGEM_LABEL.ROTA = 'Rota do CAM';
ORIGEM_LABEL.JANELA = 'Janela do CDAM';
ORIGEM_LABEL.FILA = 'Fila por antiguidade';

const ehFila = (origem) => origem === 'FILA' || origem === 'ANTIGUIDADE';

const diaPorExtenso = (iso) => `${DIAS_SEMANA[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(iso)}`;

export const gerarPdfSeparacao = ({ snapshot, diff, semanaRef, programador, encarregado, versao, emitidoEm }) => {
  if (!snapshot) throw new Error('Sem programação publicada para gerar o documento.');
  const { grade, porCam, resumo, alertas, bloqueios } = snapshot;
  const grades = snapshot.gradesConsideradas || [];
  const comPrazo = snapshot.demandas || [];

  const p = criarDocumento({
    rodape: `DepFMRJ — Programação Semanal — ${rotuloSemana(semanaRef)} — ${versao}`
  });

  p.cabecalho({
    orgao: 'Marinha do Brasil',
    unidade: 'Depósito de Fardamento da Marinha no Rio de Janeiro',
    titulo: 'PROGRAMAÇÃO SEMANAL DE ATENDIMENTO',
    subtitulo: `Semana de ${rotuloSemana(semanaRef)}`,
    selo: versao
  });

  let n = 0;
  const num = () => String(++n);

  // ── 1. Resumo ─────────────────────────────────────────────────────
  p.secao(num(), 'Resumo da Semana');
  p.numeros([
    { rotulo: 'RMs programadas', valor: resumo.totalProgramado },
    { rotulo: 'Capacidade da semana', valor: resumo.capacidadeTotal },
    { rotulo: 'Ocupação', valor: `${resumo.ocupacao}%` },
    { rotulo: 'Com prazo', valor: resumo.comPrazo },
    { rotulo: 'CAMs atendidos', valor: resumo.camsAtendidos }
  ]);
  p.paragrafo(
    `Das ${resumo.totalProgramado} RMs programadas, ${resumo.comPrazo} atendem demanda com prazo definido`
    + (resumo.porRota ? `, ${resumo.porRota} foram alocadas para pegar a rota do próprio CAM dentro da semana` : '')
    + ` e ${resumo.porAntiguidade} saem da fila por antiguidade. A fila de separação soma ${resumo.filaTotal} RMs — `
    + 'pedidos que ainda dependem de trabalho do depósito, sem contar os já conferidos e entregues à Expedição.'
    + (resumo.reemitidasNaFila
      ? ` Dessas, ${resumo.reemitidasNaFila} são RMs que já tinham sido canceladas e voltaram: elas contam pela data de entrada do ciclo novo, não pela do antigo.`
      : '')
  );

  // ── 2. Grade por CAM ──────────────────────────────────────────────
  p.secao(num(), 'Grade de Atendimento por CAM');
  p.tabela({
    colunas: [
      { key: 'cam', label: 'CAM', largura: 0.34, forte: true },
      ...grade.map(s => ({ key: s.dia, label: formatarCurto(s.dia), largura: 0.11, align: 'center' })),
      { key: 'total', label: 'Total', largura: 0.11, align: 'right', forte: true }
    ],
    linhas: porCam.map(l => ({
      cam: l.cam,
      ...Object.fromEntries(grade.map(s => [s.dia, l.porDia[s.dia] || '—'])),
      total: l.total
    })),
    rodape: {
      cam: 'TOTAL',
      ...Object.fromEntries(grade.map(s => [s.dia, s.alocacoes.length])),
      total: resumo.totalProgramado
    }
  });

  // ── 3. Grades de fornecimento ─────────────────────────────────────
  if (grades.length > 0) {
    p.secao(num(), 'Grades de Fornecimento Consideradas');
    p.paragrafo('Para cada CAM da semana: a grade dele — dia de rota, no caso de entrega nossa, ou janela do CDAM, no '
      + 'caso de retirada por terceiro —, até quando a separação precisava terminar e até que dia ela foi de fato '
      + 'programada. O que aparece como "fora do limite" vai ficar pronto e esperar a saída seguinte.');
    p.tabela({
      colunas: [
        { key: 'cam', label: 'CAM', largura: 0.30, forte: true },
        { key: 'grade', label: 'Grade de fornecimento', largura: 0.26 },
        { key: 'limite', label: 'Separar até', largura: 0.14, align: 'center' },
        { key: 'ultimo', label: 'Programado até', largura: 0.15, align: 'center' },
        { key: 'qtd', label: 'RMs', largura: 0.07, align: 'center' },
        { key: 'situacao', label: 'Situação', largura: 0.08, align: 'right' }
      ],
      linhas: grades.map(g => ({
        cam: g.sigla ? `${g.sigla} — ${g.cam}` : g.cam,
        grade: g.tipo === 'GTC' ? `Rota em ${formatarBr(g.saida)}`
          : g.tipo === 'STC' ? `Janela do CDAM até ${formatarBr(g.saida)}` : 'sem grade cadastrada',
        limite: g.limite ? formatarBr(g.limite) : '—',
        ultimo: formatarBr(g.ultimoDia),
        qtd: g.qtd,
        situacao: g.dentro === null ? '—' : g.dentro ? 'no prazo' : 'fora',
        situacao_cor: g.dentro === false ? AMBAR : undefined
      })),
      rodape: {
        cam: 'TOTAL',
        grade: `${resumo.camsNoLimite ?? 0} no prazo · ${resumo.camsForaDoLimite ?? 0} fora · ${resumo.camsSemGrade ?? 0} sem grade`,
        limite: '', ultimo: '',
        qtd: grades.reduce((t, g) => t + g.qtd, 0),
        situacao: ''
      }
    });
  }

  // ── 4. Dias sem separação ─────────────────────────────────────────
  if (bloqueios.length > 0) {
    p.secao(num(), 'Dias sem Separação');
    p.tabela({
      colunas: [
        { key: 'data', label: 'Data', largura: 0.22, forte: true },
        { key: 'dia', label: 'Dia da semana', largura: 0.26 },
        { key: 'motivo', label: 'Motivo', largura: 0.52 }
      ],
      linhas: bloqueios.map(b => ({
        data: formatarBr(b.data),
        dia: DIAS_SEMANA[new Date(b.data + 'T00:00:00Z').getUTCDay()],
        motivo: b.motivo
      }))
    });
  }

  // ── 5. Demandas com prazo ─────────────────────────────────────────
  if (comPrazo.length > 0) {
    p.secao(num(), 'Demandas com Prazo');
    p.tabela({
      colunas: [
        { key: 'ref', label: 'Origem / Referência', largura: 0.36, forte: true },
        { key: 'rms', label: 'RMs informadas', largura: 0.16, align: 'center' },
        { key: 'prazo', label: 'Prazo', largura: 0.16, align: 'center' },
        { key: 'limite', label: 'Separar até', largura: 0.16, align: 'center' },
        { key: 'exp', label: 'Dias exped.', largura: 0.16, align: 'center' }
      ],
      linhas: comPrazo.map(d => ({
        ref: `${ORIGEM_LABEL[d.origem] || d.origem}${d.referencia ? ` — ${d.referencia}` : ''}`,
        rms: d.qtd,
        prazo: formatarBr(d.prazo),
        limite: formatarBr(limiteDeSeparacao(d.prazo, d.diasExpedicao)),
        exp: `${d.diasExpedicao} úteis`
      }))
    });
  }

  // ── 6. Observações ────────────────────────────────────────────────
  if (alertas.length > 0) {
    p.secao(num(), 'Observações');
    alertas.forEach(a => {
      p.reservar(10);
      const topo = p.y;
      p.texto(a.texto, { tamanho: 8.5, cor: TINTA, x: 15.5, largura: 182.5, entrelinha: 1.4, espacoDepois: 2.2 });
      const cor = a.nivel === 'critico' ? VERMELHO : AMBAR;
      p.doc.setDrawColor(cor[0], cor[1], cor[2]);
      p.doc.setLineWidth(0.8);
      p.doc.line(12.4, topo, 12.4, p.y - 2.2);
    });
  }

  p.assinaturas([
    { nome: programador, papel: 'Programador do DepFMRJ' },
    { nome: encarregado, papel: 'Encarregado do Abastecimento' }
  ]);

  // ── Anexo A ───────────────────────────────────────────────────────
  // Agrupa por dia, depois por origem e CAM. Listar 400 linhas uma a uma
  // não se lê; agrupado, cada linha já traz o porquê de todas as RMs.
  const anexo = grade.filter(s => s.alocacoes.length).map(slot => {
    const grupos = new Map();
    slot.alocacoes.forEach(a => {
      const cam = a.cam || '(sem CAM)';
      // Na fila por antiguidade a justificativa carrega os dias de cada
      // RM, então agrupar por ela devolveria um grupo por RM.
      const chave = ehFila(a.origem) ? `FILA||${cam}` : `${a.justificativa}||${cam}`;
      if (!grupos.has(chave)) grupos.set(chave, { justificativa: a.justificativa, cam, origem: a.origem, rms: [], dias: [] });
      const g = grupos.get(chave);
      g.rms.push(a.rm);
      if (a.diasEmFila != null) g.dias.push(a.diasEmFila);
    });
    grupos.forEach(g => {
      if (!ehFila(g.origem) || !g.dias.length) return;
      const min = Math.min(...g.dias);
      const max = Math.max(...g.dias);
      g.justificativa = min === max
        ? `Fila por antiguidade — ${max} dias em espera`
        : `Fila por antiguidade — de ${min} a ${max} dias em espera`;
    });
    return { slot, grupos: Array.from(grupos.values()).sort((a, b) => b.rms.length - a.rms.length) };
  });

  if (anexo.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO A — DETALHAMENTO DO ATENDIMENTO',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)} · ${versao} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Relação das RMs programadas, por dia, com a razão de cada bloco estar na grade. As RMs de uma mesma '
      + 'origem e mesmo CAM aparecem agrupadas numa linha só.');
    anexo.forEach(({ slot, grupos }) => {
      p.reservar(22);
      p.texto(`${diaPorExtenso(slot.dia)} — ${slot.alocacoes.length} RM(s)`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      grupos.forEach(g => {
        p.reservar(12);
        p.texto(`${g.cam} — ${g.rms.length} RM(s)   ·   ${g.justificativa}`,
          { tamanho: 8, estilo: 'bold', cor: TINTA, espacoDepois: 0.5 });
        p.gradeDeRms(g.rms.map(rm => ({ rm })));
      });
      p.y += 2;
    });
  }

  // ── Anexo B: o que mudou nesta versão ─────────────────────────────
  if (diff) {
    p.tituloDeAnexo({
      titulo: 'ANEXO B — ALTERAÇÕES DESTA VERSÃO',
      subtitulo: `${versao} · o que mudou em relação à versão anterior · emitido em ${emitidoEm}`
    });
    p.numeros([
      { rotulo: 'RMs incluídas', valor: diff.entraram.length },
      { rotulo: 'RMs retiradas', valor: diff.sairam.length },
      { rotulo: 'RMs remanejadas', valor: diff.remanejadas.length },
      { rotulo: 'Saldo programado', valor: `${diff.deltaProgramado > 0 ? '+' : ''}${diff.deltaProgramado}` }
    ]);

    if (diff.demandasNovas.length > 0) {
      p.texto('Demandas que motivaram a alteração', { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      p.tabela({
        colunas: [
          { key: 'ref', label: 'Origem / Referência', largura: 0.44, forte: true },
          { key: 'rms', label: 'RMs informadas', largura: 0.18, align: 'center' },
          { key: 'prazo', label: 'Prazo', largura: 0.19, align: 'center' },
          { key: 'limite', label: 'Separar até', largura: 0.19, align: 'center' }
        ],
        linhas: diff.demandasNovas.map(d => ({
          ref: `${ORIGEM_LABEL[d.origem] || d.origem}${d.referencia ? ` — ${d.referencia}` : ''}`,
          rms: d.qtd,
          prazo: formatarBr(d.prazo),
          limite: formatarBr(limiteDeSeparacao(d.prazo, d.diasExpedicao))
        }))
      });
    }

    if (diff.bloqueiosNovos.length > 0 || diff.bloqueiosRemovidos.length > 0) {
      p.texto('Mudanças nos dias de separação', { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      diff.bloqueiosNovos.forEach(b =>
        p.texto(`${formatarBr(b.data)} passou a não ter separação — ${b.motivo}`, { tamanho: 8.5, cor: SUAVE, espacoDepois: 1 }));
      diff.bloqueiosRemovidos.forEach(b =>
        p.texto(`${formatarBr(b.data)} voltou a ter separação`, { tamanho: 8.5, cor: SUAVE, espacoDepois: 1 }));
      p.y += 3;
    }

    [
      { titulo: 'RMs incluídas nesta versão', itens: diff.entraram },
      { titulo: 'RMs retiradas da programação', itens: diff.sairam }
    ].filter(b => b.itens.length > 0).forEach(bloco => {
      p.reservar(20);
      p.texto(`${bloco.titulo} — ${bloco.itens.length} RM(s)`, { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      agruparParaAnexo(bloco.itens).forEach(g => {
        p.reservar(12);
        p.texto(`${g.cam} — ${g.rms.length} RM(s)   ·   ${g.justificativa}`,
          { tamanho: 8, estilo: 'bold', cor: TINTA, espacoDepois: 0.5 });
        p.gradeDeRms(g.rms.map(rm => ({ rm })));
      });
      p.y += 2;
    });

    if (diff.remanejadas.length > 0) {
      p.reservar(20);
      p.texto(`RMs que mudaram de dia — ${diff.remanejadas.length} RM(s)`, { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      const porMudanca = diff.remanejadas.reduce((acc, a) => {
        const chave = `${a.diaAnterior}→${a.dia}`;
        (acc[chave] = acc[chave] || []).push(a.rm);
        return acc;
      }, {});
      Object.entries(porMudanca).forEach(([chave, rms]) => {
        const [de, para] = chave.split('→');
        p.reservar(12);
        p.texto(`De ${formatarBr(de)} para ${formatarBr(para)} — ${rms.length} RM(s)`,
          { tamanho: 8, estilo: 'bold', cor: TINTA, espacoDepois: 0.5 });
        p.gradeDeRms(rms.map(rm => ({ rm })));
      });
    }

    if (diff.totalMudancas === 0) {
      p.paragrafo('Nenhuma RM mudou de dia, entrou ou saiu em relação à versão anterior.');
    }
  }

  const sufixo = versao && versao.toLowerCase().includes('original') ? 'Original' : versao.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  p.salvar(`Programacao_Semanal_${semanaRef}_${sufixo}.pdf`);
};
