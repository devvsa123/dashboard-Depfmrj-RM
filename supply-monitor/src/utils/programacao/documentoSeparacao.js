import { criarDocumento, TINTA, SUAVE, CLARO, VERMELHO, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana } from './semana';
import { ORIGENS, limiteDeSeparacao } from './motor';
import { agruparParaAnexo, ordemDeLiberacao, sufixoDeArquivo } from './versoes';

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

  // ── As RMs com prazo, isoladas ────────────────────────────────────
  //
  // Demanda com prazo é compromisso formal, e o programador precisa
  // vê-la sem procurar: ela aparece destacada na grade, nos blocos de
  // marcação e numa tabela que diz, por demanda, o que está sendo
  // feito. O documento não cresce por isso — as mesmas tabelas passam
  // a distinguir o que é prazo do que é fila.
  const temPrazo = (a) => Boolean(a.prazo);
  const prazoPorCamDia = new Map();
  const prazoPorDemanda = new Map();
  grade.forEach(slot => slot.alocacoes.forEach(a => {
    if (!temPrazo(a)) return;
    const chave = `${a.cam || '(sem CAM)'}||${slot.dia}`;
    prazoPorCamDia.set(chave, (prazoPorCamDia.get(chave) || 0) + 1);
    if (!a.demandaId) return;
    if (!prazoPorDemanda.has(a.demandaId)) prazoPorDemanda.set(a.demandaId, { qtd: 0, porDia: new Map(), cams: new Set() });
    const d = prazoPorDemanda.get(a.demandaId);
    d.qtd++;
    d.porDia.set(slot.dia, (d.porDia.get(slot.dia) || 0) + 1);
    d.cams.add(a.cam || '(sem CAM)');
  }));
  const totalComPrazo = grade.reduce((t, s) => t + s.alocacoes.filter(temPrazo).length, 0);

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
  // A regra do agrupamento precisa estar no papel: é ela que explica
  // por que um CAM aparece num dia só, e é dela que depende a montagem
  // da capa de lote no WMS.
  p.paragrafo('Cada CAM é atendido num único dia da semana, para que a reserva no WMS seja montada de uma vez: '
    + 'um cliente, uma capa de lote. Um CAM só aparece em mais de um dia quando tem mais RMs do que cabe num dia '
    + 'inteiro — nesse caso a divisão vem avisada nas observações.');
  if (totalComPrazo > 0) {
    p.texto('Nas casas com dois números, o primeiro é a fila por antiguidade e o segundo, em âmbar, são as RMs de '
      + 'demanda com prazo.', { tamanho: 7.5, cor: SUAVE, espacoDepois: 2 });
  }
  // Uma casa pode valer duas coisas: quanto sai pela fila e quanto sai
  // por compromisso de prazo. Separar as duas numa casa só evita uma
  // tabela a mais e põe o prazo onde ele é lido.
  const casaDaGrade = (cam, dia, total) => {
    if (!total) return '—';
    const prazo = prazoPorCamDia.get(`${cam}||${dia}`) || 0;
    if (!prazo) return String(total);
    if (prazo === total) return { partes: [{ texto: String(prazo), cor: AMBAR, forte: true }] };
    return {
      partes: [
        { texto: String(total - prazo), cor: SUAVE },
        { texto: ' + ', cor: CLARO },
        { texto: String(prazo), cor: AMBAR, forte: true }
      ]
    };
  };
  p.tabela({
    colunas: [
      { key: 'cam', label: 'CAM', largura: 0.34, forte: true },
      ...grade.map(s => ({ key: s.dia, label: formatarCurto(s.dia), largura: 0.11, align: 'center' })),
      { key: 'total', label: 'Total', largura: 0.11, align: 'right', forte: true }
    ],
    linhas: porCam.map(l => ({
      cam: l.cam,
      ...Object.fromEntries(grade.map(s => [s.dia, casaDaGrade(l.cam, s.dia, l.porDia[s.dia] || 0)])),
      total: l.total
    })),
    rodape: {
      cam: 'TOTAL',
      ...Object.fromEntries(grade.map(s => [s.dia, s.alocacoes.length])),
      total: resumo.totalProgramado
    }
  });

  // ── 3. Os blocos de marcação no WMS ───────────────────────────────
  //
  // É a seção que o operador leva para a tela. Cada linha é uma capa de
  // lote: o cliente, quantas RMs e ATÉ ONDE marcar. A tela lista as RMs
  // em aberto do cliente por antiguidade e a programação as toma na
  // mesma ordem, então marcar é ir da primeira linha até o corte — sem
  // conferir RM a RM, que é o que custava o dia do operador.
  const blocos = snapshot.blocos || [];
  if (blocos.length > 0) {
    p.secao(num(), 'Montagem da Fila no WMS');
    p.paragrafo('Uma linha por capa de lote. Filtre o cliente na AK050 e marque como diz a coluna "O que marcar": '
      + '"tudo" quando o bloco é tudo o que o cliente tem em aberto, ou "até a RM X" quando a semana leva só a parte '
      + 'mais antiga — a tela ordena por antiguidade, então é da primeira linha até essa RM, sem pular nenhuma. '
      + 'Quando uma demanda com prazo pede RMs fora dessa ordem, elas vêm somadas e nomeadas: marque o trecho e '
      + 'acrescente as avulsas. Nunca é preciso desmarcar nada.');
    p.tabela({
      colunas: [
        { key: 'dia', label: 'Dia', largura: 0.13 },
        { key: 'ordem', label: 'Bloco', largura: 0.07, align: 'center' },
        { key: 'cam', label: 'CAM', largura: 0.3, forte: true },
        { key: 'qtd', label: 'RMs', largura: 0.09, align: 'center', forte: true },
        { key: 'prazo', label: 'C/ prazo', largura: 0.09, align: 'center' },
        { key: 'marcar', label: 'O que marcar na tela', largura: 0.32 }
      ],
      linhas: blocos.map(b => ({
        dia: formatarCurto(b.dia),
        ordem: b.ordem,
        cam: b.cam,
        qtd: b.qtd,
        prazo: b.comPrazo ? String(b.comPrazo) : '—',
        prazo_cor: b.comPrazo ? AMBAR : undefined,
        marcar: b.cobertura === 'TOTAL'
          ? `Tudo o que o CAM tem em aberto (${b.pendentesDoCam})`
          : b.cobertura === 'ATE_O_CORTE'
            ? `Da mais antiga até a RM ${b.corte?.rm} (${formatarBr(b.corte?.entrada)})`
            : b.cobertura === 'CORTE_MAIS_AVULSAS'
              ? `Até a RM ${b.corte?.rm} (${b.ateOCorte}) + ${b.avulsas.length} avulsa(s): ${b.avulsas.join(', ')}`
              : `Só estas ${b.avulsas.length}: ${b.avulsas.join(', ')}`,
        marcar_cor: b.avulsas.length ? AMBAR : undefined
      }))
    });
    const comAvulsas = blocos.filter(b => b.avulsas.length > 0);
    const empates = blocos.filter(b => b.cobertura === 'ATE_O_CORTE' && b.empateNoCorte > 1);
    if (comAvulsas.length === 0) {
      p.texto(`Nos ${blocos.length} blocos, a marcação é contínua: nenhuma RM avulsa a procurar.`,
        { tamanho: 7.5, cor: SUAVE, espacoDepois: 2 });
    } else {
      const avulsas = comAvulsas.reduce((t, b) => t + b.avulsas.length, 0);
      p.texto(`${avulsas} RM(s) avulsa(s) em ${comAvulsas.length} bloco(s), todas de demanda com prazo: marque o `
        + 'trecho contínuo e acrescente as RMs nomeadas acima.', { tamanho: 7.5, cor: AMBAR, espacoDepois: 2 });
    }
    if (empates.length > 0) {
      p.texto(`Em ${empates.length} bloco(s) o corte cai numa data com mais de uma RM do mesmo CAM; se a tela não `
        + 'ordenar por número dentro da mesma data, confira só essas linhas.', { tamanho: 7.5, cor: SUAVE, espacoDepois: 2 });
    }
  }

  // ── 4. Grades de fornecimento ─────────────────────────────────────
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

  // ── 5. Demandas com prazo: o que está sendo feito com cada uma ────
  //
  // Uma linha por demanda, com o que a semana faz por ela: quantas RMs
  // entraram, em que dias, e se a separação termina a tempo. É a tabela
  // que responde "e a minha mensagem?" sem folhear o documento.
  if (comPrazo.length > 0) {
    p.secao(num(), 'Demandas com Prazo');
    p.paragrafo('O que esta semana faz por cada demanda com prazo. "Na semana" é quanto entrou na grade; '
      + '"separação em" são os dias em que essas RMs serão separadas. O prazo é de prontificação, por isso a '
      + 'separação precisa terminar antes — é a coluna "separar até".');
    p.tabela({
      colunas: [
        { key: 'ref', label: 'Origem / Referência', largura: 0.27, forte: true },
        { key: 'rms', label: 'RMs', largura: 0.07, align: 'center' },
        { key: 'semana', label: 'Na semana', largura: 0.11, align: 'center' },
        { key: 'dias', label: 'Separação em', largura: 0.21, align: 'center' },
        { key: 'prazo', label: 'Prazo', largura: 0.12, align: 'center' },
        { key: 'limite', label: 'Separar até', largura: 0.12, align: 'center' },
        { key: 'situacao', label: 'Situação', largura: 0.10, align: 'right' }
      ],
      linhas: comPrazo.map(d => {
        const limite = limiteDeSeparacao(d.prazo, d.diasExpedicao);
        const naGrade = prazoPorDemanda.get(d.id);
        const dias = naGrade ? Array.from(naGrade.porDia.keys()).sort() : [];
        const ultimo = dias.length ? dias[dias.length - 1] : null;
        const dentro = ultimo && limite ? ultimo <= limite : null;
        const fora = (d.qtdNaSemana ?? 0) < (d.qtd ?? 0);
        return {
          ref: `${ORIGEM_LABEL[d.origem] || d.origem}${d.referencia ? ` — ${d.referencia}` : ''}`,
          rms: d.qtd,
          semana: naGrade ? naGrade.qtd : (d.qtdNaSemana ?? 0),
          semana_cor: naGrade && naGrade.qtd ? AMBAR : VERMELHO,
          dias: dias.length
            ? dias.map(x => `${formatarCurto(x)} (${naGrade.porDia.get(x)})`).join(', ')
            : 'não programada',
          prazo: formatarBr(d.prazo),
          limite: formatarBr(limite),
          situacao: dentro === null ? '—' : dentro ? (fora ? 'parcial' : 'no prazo') : 'atrasa',
          situacao_cor: dentro === false ? VERMELHO : dentro && !fora ? undefined : AMBAR
        };
      })
    });
    p.texto(`${totalComPrazo} RM(s) de demanda com prazo nesta semana, de ${comPrazo.length} demanda(s). `
      + 'Na grade por CAM elas aparecem em âmbar, separadas da fila por antiguidade.',
    { tamanho: 7.5, cor: SUAVE, espacoDepois: 2 });
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
      if (!grupos.has(chave)) grupos.set(chave, { justificativa: a.justificativa, cam, origem: a.origem, prazo: a.prazo || null, rms: [], dias: [] });
      const g = grupos.get(chave);
      g.rms.push({ rm: a.rm, entrada: a.entrada || null });
      if (a.diasEmFila != null) g.dias.push(a.diasEmFila);
    });
    grupos.forEach(g => {
      // Ordem de liberação, mais antiga em cima — a mesma do WMS.
      g.rms.sort(ordemDeLiberacao);
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
      + 'origem e mesmo CAM aparecem agrupadas numa linha só, na ordem de liberação do WMS — mais antiga primeiro, '
      + 'com a data ao lado.');
    anexo.forEach(({ slot, grupos }) => {
      p.reservar(22);
      p.texto(`${diaPorExtenso(slot.dia)} — ${slot.alocacoes.length} RM(s)`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      grupos.forEach(g => {
        p.reservar(12);
        // Grupo de demanda com prazo sai em âmbar e com a marca: é o que
        // o programador procura primeiro quando abre o anexo.
        const cabecalho = g.prazo
          ? `${g.cam} — ${g.rms.length} RM(s)   ·   PRAZO ${formatarBr(g.prazo)} · ${g.justificativa}`
          : `${g.cam} — ${g.rms.length} RM(s)   ·   ${g.justificativa}`;
        p.texto(cabecalho, { tamanho: 8, estilo: 'bold', cor: g.prazo ? AMBAR : TINTA, espacoDepois: 0.5 });
        p.gradeDeRms(g.rms.map(r => ({ rm: r.rm, nota: r.entrada ? formatarBr(r.entrada).slice(0, 5) : '' })), { colunas: 5 });
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
        p.gradeDeRms(g.rms.map(r => ({ rm: r.rm, nota: r.entrada ? formatarBr(r.entrada).slice(0, 5) : '' })), { colunas: 5 });
      });
      p.y += 2;
    });

    if (diff.remanejadas.length > 0) {
      p.reservar(20);
      p.texto(`RMs que mudaram de dia — ${diff.remanejadas.length} RM(s)`, { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 2);
      const porMudanca = diff.remanejadas.reduce((acc, a) => {
        const chave = `${a.diaAnterior}→${a.dia}`;
        (acc[chave] = acc[chave] || []).push({ rm: a.rm, entrada: a.entrada || null });
        return acc;
      }, {});
      Object.values(porMudanca).forEach(lista => lista.sort(ordemDeLiberacao));
      Object.entries(porMudanca).forEach(([chave, rms]) => {
        const [de, para] = chave.split('→');
        p.reservar(12);
        p.texto(`De ${formatarBr(de)} para ${formatarBr(para)} — ${rms.length} RM(s)`,
          { tamanho: 8, estilo: 'bold', cor: TINTA, espacoDepois: 0.5 });
        p.gradeDeRms(rms.map(r => ({ rm: r.rm || r, nota: r.entrada ? formatarBr(r.entrada).slice(0, 5) : '' })), { colunas: 5 });
      });
    }

    if (diff.totalMudancas === 0) {
      p.paragrafo('Nenhuma RM mudou de dia, entrou ou saiu em relação à versão anterior.');
    }
  }

  const sufixo = sufixoDeArquivo(versao);
  p.salvar(`Programacao_Semanal_${semanaRef}_${sufixo}.pdf`);
};
