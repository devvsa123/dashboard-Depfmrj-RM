import { formatarBr, rotuloSemana, DIAS_SEMANA, DIAS_CURTOS } from './semana';
import { ORIGENS, limiteDeSeparacao } from './motor';
import { ACOES } from './expedicao';
import { rotaDescrita, TRATAMENTOS } from './rotas';
import { ordemDeLiberacao, sufixoDeArquivo } from './versoes';

// -----------------------------------------------------------------------
// Exportação em Excel dos dois documentos.
//
// O PDF é o que se assina; a planilha é o que se manuseia. Por isso ela
// tem uma aba que o PDF não tem: UMA LINHA POR RM, com tudo o que o
// operador precisa para trabalhar a reserva no WMS — número, cliente,
// documento a lançar, prazos e a data de liberação. É essa aba que se
// filtra, ordena e cola.
//
// A relação de RMs segue a ordem de trabalho: primeiro o dia, porque é
// por dia que o serviço é distribuído; dentro do dia, o cliente, que é a
// unidade da reserva; e dentro do cliente, a data de liberação, mais
// antiga em cima, que é a ordem em que o WMS mostra a reserva. Além da
// aba única, cada dia ganha a sua, para quem trabalha aquele dia abrir
// a própria e não precisar filtrar nada.
// -----------------------------------------------------------------------

const ORIGEM_LABEL = Object.fromEntries(ORIGENS.map(o => [o.key, o.label]));
ORIGEM_LABEL.FORCADO = 'Forçado pelo programador';
ORIGEM_LABEL.ANTIGUIDADE = 'Fila por antiguidade';
ORIGEM_LABEL.ROTA = 'Rota do CAM';
ORIGEM_LABEL.JANELA = 'Janela do CDAM';
ORIGEM_LABEL.FILA = 'Fila por antiguidade';

const diaPorExtenso = (iso) => `${DIAS_SEMANA[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(iso)}`;
const diaCurto = (iso) => DIAS_CURTOS[new Date(iso + 'T00:00:00Z').getUTCDay()];
// Nome de aba: o Excel recusa / \ : * ? [ ] e para em 31 caracteres.
const abaDoDia = (iso) => `${formatarBr(iso).slice(0, 5).replace('/', '-')} ${diaCurto(iso)}`;

// Ordem de trabalho: dia, depois cliente (na ordem em que o dia o
// apresenta), depois data de liberação.
const porDiaCamLiberacao = (ordemDoCam) => (x, y) => {
  if (x.dia !== y.dia) return x.dia.localeCompare(y.dia);
  const ax = ordemDoCam.get(`${x.dia}||${x.cam || ''}`) ?? 0;
  const ay = ordemDoCam.get(`${y.dia}||${y.cam || ''}`) ?? 0;
  if (ax !== ay) return ax - ay;
  return ordemDeLiberacao(x, y);
};

// Índice de aparição de cada cliente dentro do dia, na ordem em que a
// própria programação o apresenta.
const indexarCams = (itens) => {
  const mapa = new Map();
  itens.forEach(i => {
    const chave = `${i.dia}||${i.cam || ''}`;
    if (!mapa.has(chave)) mapa.set(chave, mapa.size);
  });
  return mapa;
};
const data = (iso) => (iso ? formatarBr(iso) : '');

// Larguras de coluna a partir do conteúdo: sem isso o Excel abre tudo
// com 8 caracteres e o usuário passa o primeiro minuto arrastando borda.
const comLarguras = (linhas) => {
  if (!linhas.length) return [];
  return Object.keys(linhas[0]).map(chave => ({
    wch: Math.min(48, Math.max(
      String(chave).length + 2,
      ...linhas.map(l => String(l[chave] ?? '').length + 2)
    ))
  }));
};

const montarLivro = (abas, nomeDoArquivo) => {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('A biblioteca de planilhas não carregou. Recarregue a página.');
  const livro = XLSX.utils.book_new();
  abas.filter(a => a.linhas.length > 0).forEach(aba => {
    const folha = XLSX.utils.json_to_sheet(aba.linhas);
    folha['!cols'] = comLarguras(aba.linhas);
    XLSX.utils.book_append_sheet(livro, folha, aba.nome.slice(0, 31));
  });
  XLSX.writeFile(livro, nomeDoArquivo);
};

// ── Documento da separação ──────────────────────────────────────────
export const exportarExcelSeparacao = ({ snapshot, semanaRef, versao, emitidoEm }) => {
  if (!snapshot) throw new Error('Sem programação publicada para exportar.');
  const { grade, porCam, resumo, alertas, bloqueios } = snapshot;
  const grades = snapshot.gradesConsideradas || [];

  const resumoLinhas = [
    { Campo: 'Semana', Valor: rotuloSemana(semanaRef) },
    { Campo: 'Versão', Valor: versao },
    { Campo: 'Emitido em', Valor: emitidoEm },
    { Campo: 'RMs programadas', Valor: resumo.totalProgramado },
    { Campo: 'Capacidade da semana', Valor: resumo.capacidadeTotal },
    { Campo: 'Ocupação (%)', Valor: resumo.ocupacao },
    { Campo: 'Com prazo', Valor: resumo.comPrazo },
    { Campo: 'Por rota ou janela', Valor: resumo.porRota ?? 0 },
    { Campo: 'Por antiguidade', Valor: resumo.porAntiguidade },
    { Campo: 'Forçadas', Valor: resumo.forcadas ?? 0 },
    { Campo: 'CAMs atendidos', Valor: resumo.camsAtendidos },
    { Campo: 'Fila de separação', Valor: resumo.filaTotal },
    // O agrupamento é o que torna a aba de cada dia utilizável na
    // montagem da capa de lote: um cliente, um bloco.
    { Campo: 'Agrupamento', Valor: 'Um CAM por dia — reserve o cliente inteiro de uma vez' },
    { Campo: 'RMs fora da semana por falta de espaço no dia do CAM', Valor: resumo.sobraPorAgrupamento ?? 0 },
    { Campo: 'CAMs maiores que um dia (divididos)', Valor: resumo.camsDivididos ?? 0 },
    { Campo: 'CAMs adiados inteiros (não cabiam em nenhum dia)', Valor: resumo.camsAdiadosInteiros ?? 0 },
    { Campo: 'Blocos a montar no WMS', Valor: resumo.blocosTotais ?? 0 },
    { Campo: 'Blocos com RMs avulsas a marcar', Valor: resumo.blocosComAvulsas ?? 0 },
    { Campo: 'RMs avulsas na marcação', Valor: resumo.rmsAvulsasNaMarcacao ?? 0 }
  ];

  // Uma linha por RM: a aba que se usa para trabalhar. Na ordem do
  // serviço — o que se separa na segunda, depois o da terça, e assim
  // por diante; dentro do dia, por cliente e por data de liberação.
  const alocadas = [];
  grade.forEach(slot => slot.alocacoes.forEach(a => alocadas.push({ ...a, dia: slot.dia })));
  alocadas.sort(porDiaCamLiberacao(indexarCams(alocadas)));

  const linhaDeRm = (a) => ({
    RM: a.rm,
    CAM: a.cam || '',
    // Primeira coluna de filtro do operador: o que é compromisso de
    // prazo e o que é fila.
    Prioridade: a.prazo ? 'PRAZO' : '',
    'Data de liberação': data(a.entrada),
    'Dias em fila': a.diasEmFila ?? '',
    Origem: ORIGEM_LABEL[a.origem] || a.origem,
    'Por que está na grade': a.justificativa || '',
    'Prazo da demanda': data(a.prazo)
  });
  const rms = alocadas.map(a => ({
    'Dia de separação': formatarBr(a.dia),
    'Dia da semana': DIAS_SEMANA[new Date(a.dia + 'T00:00:00Z').getUTCDay()],
    ...linhaDeRm(a)
  }));

  // E uma aba por dia, para quem trabalha aquele dia abrir a própria.
  //
  // A coluna BLOCO é a ordem de montagem no WMS: cada bloco é um CAM,
  // que vira uma capa de lote montada de uma vez na AK050. Monte o
  // bloco 1, reserve, depois o 2 — sem caçar RM solta na tela.
  const abasPorDia = grade.map(slot => {
    const doDia = alocadas.filter(a => a.dia === slot.dia);
    const blocos = new Map();
    doDia.forEach(a => {
      const cam = a.cam || '(sem CAM)';
      if (!blocos.has(cam)) blocos.set(cam, blocos.size + 1);
    });
    return {
      nome: abaDoDia(slot.dia),
      linhas: doDia.map(a => ({ Bloco: blocos.get(a.cam || '(sem CAM)'), ...linhaDeRm(a) }))
    };
  });

  // O que a semana faz por cada demanda com prazo.
  const porDemanda = new Map();
  grade.forEach(slot => slot.alocacoes.forEach(a => {
    if (!a.prazo || !a.demandaId) return;
    if (!porDemanda.has(a.demandaId)) porDemanda.set(a.demandaId, { qtd: 0, porDia: new Map(), cams: new Set() });
    const d = porDemanda.get(a.demandaId);
    d.qtd++;
    d.porDia.set(slot.dia, (d.porDia.get(slot.dia) || 0) + 1);
    d.cams.add(a.cam || '(sem CAM)');
  }));

  // Quantas RMs com prazo cada CAM tem em cada dia: é o mesmo destaque
  // que o PDF dá em âmbar, aqui em coluna para poder filtrar.
  const prazoPorCamDia = new Map();
  grade.forEach(slot => slot.alocacoes.forEach(a => {
    if (!a.prazo) return;
    const chave = `${a.cam || '(sem CAM)'}||${slot.dia}`;
    prazoPorCamDia.set(chave, (prazoPorCamDia.get(chave) || 0) + 1);
  }));
  const comPrazoDoCam = (cam) => grade.reduce((t, s) => t + (prazoPorCamDia.get(`${cam}||${s.dia}`) || 0), 0);

  const gradePorCam = porCam.map(l => ({
    CAM: l.cam,
    ...Object.fromEntries(grade.flatMap(s => [
      [formatarBr(s.dia), l.porDia[s.dia] || 0],
      [`${formatarBr(s.dia)} c/ prazo`, prazoPorCamDia.get(`${l.cam}||${s.dia}`) || 0]
    ])),
    Total: l.total,
    'Total c/ prazo': comPrazoDoCam(l.cam)
  }));

  // A aba que vai para a tela do WMS: uma linha por capa de lote.
  const blocosLinhas = (snapshot.blocos || []).map(b => ({
    Dia: formatarBr(b.dia),
    Bloco: b.ordem,
    CAM: b.cam,
    RMs: b.qtd,
    'RMs com prazo': b.comPrazo || 0,
    'Em aberto no CAM': b.pendentesDoCam,
    'O que marcar na tela': b.cobertura === 'TOTAL'
      ? 'Tudo o que o CAM tem em aberto'
      : b.cobertura === 'ATE_O_CORTE'
        ? `Da mais antiga até a RM ${b.corte?.rm}`
        : b.cobertura === 'CORTE_MAIS_AVULSAS'
          ? `Até a RM ${b.corte?.rm} + as avulsas ao lado`
          : 'Só as avulsas ao lado',
    'RM do corte': b.corte?.rm || '',
    'Liberação do corte': data(b.corte?.entrada),
    'RMs no trecho': b.ateOCorte ?? '',
    'Marcar também (avulsas)': (b.avulsas || []).join(' ')
  }));

  montarLivro([
    { nome: 'Resumo', linhas: resumoLinhas },
    { nome: 'Montagem no WMS', linhas: blocosLinhas },
    { nome: 'RMs', linhas: rms },
    ...abasPorDia,
    { nome: 'Grade por CAM', linhas: gradePorCam },
    {
      nome: 'Grades de fornecimento',
      linhas: grades.map(g => ({
        CAM: g.cam,
        Sigla: g.sigla || '',
        Tratamento: g.tratamento,
        'Grade de fornecimento': g.tipo === 'GTC' ? `Rota em ${data(g.saida)}`
          : g.tipo === 'STC' ? `Janela do CDAM até ${data(g.saida)}` : 'sem grade cadastrada',
        'Separar até': data(g.limite),
        'Programado até': data(g.ultimoDia),
        RMs: g.qtd,
        Situação: g.dentro === null ? 'sem grade' : g.dentro ? 'no prazo' : 'fora do limite'
      }))
    },
    {
      nome: 'Demandas com prazo',
      linhas: (snapshot.demandas || []).map(d => {
        const limite = limiteDeSeparacao(d.prazo, d.diasExpedicao);
        const naGrade = porDemanda.get(d.id);
        const dias = naGrade ? Array.from(naGrade.porDia.keys()).sort() : [];
        const ultimo = dias.length ? dias[dias.length - 1] : null;
        return {
          Origem: ORIGEM_LABEL[d.origem] || d.origem,
          Referência: d.referencia || '',
          'RMs informadas': d.qtd,
          'RMs nesta semana': naGrade ? naGrade.qtd : (d.qtdNaSemana ?? 0),
          'Separação em': dias.map(x => `${formatarBr(x)} (${naGrade.porDia.get(x)})`).join(', '),
          CAMs: naGrade ? Array.from(naGrade.cams).join(', ') : '',
          Prazo: data(d.prazo),
          'Separar até': data(limite),
          'Dias p/ expedição': d.diasExpedicao,
          Situação: !ultimo ? 'não programada' : (limite && ultimo > limite ? 'atrasa' : 'no prazo')
        };
      })
    },
    {
      nome: 'Dias sem separação',
      linhas: bloqueios.map(b => ({ Data: formatarBr(b.data), 'Dia da semana': DIAS_SEMANA[new Date(b.data + 'T00:00:00Z').getUTCDay()], Motivo: b.motivo }))
    },
    { nome: 'Observações', linhas: alertas.map(a => ({ Nível: a.nivel === 'critico' ? 'Crítico' : 'Atenção', Observação: a.texto })) }
  ], `Programacao_Semanal_${semanaRef}_${sufixoDeArquivo(versao)}.xlsx`);
};

// ── Documento da Expedição ──────────────────────────────────────────
export const exportarExcelExpedicao = ({ projecao, semanaRef, versao, emitidoEm }) => {
  if (!projecao) throw new Error('Sem programação da Expedição para exportar.');
  const { resumo, blocos, agenda, depois } = projecao;

  const resumoLinhas = [
    { Campo: 'Semana', Valor: rotuloSemana(semanaRef) },
    { Campo: 'Versão', Valor: versao || 'sem versão publicada' },
    { Campo: 'Emitido em', Valor: emitidoEm },
    { Campo: 'RMs programadas', Valor: resumo.total },
    { Campo: 'Clientes', Valor: resumo.cams },
    { Campo: 'A lançar GTC', Valor: resumo.gtc },
    { Campo: 'A lançar STC', Valor: resumo.stc },
    { Campo: 'Entregas na semana', Valor: resumo.entregas }
  ];

  const linhaDeAgenda = (dia, b) => ({
    Dia: dia ? diaPorExtenso(dia) : 'Depois desta semana',
    CAM: b.cam,
    Sigla: b.sigla || '',
    Ação: b.acao.label,
    'Documento a lançar': b.documentoEsperado,
    RMs: b.qtd,
    'Prontificar até': b.acao === ACOES.ENTREGAR ? '' : data(b.prazo),
    'Prazo que manda': b.acao === ACOES.ENTREGAR ? '' : b.motivo,
    'Entregar em': data(b.entregarEm),
    'Aprovar STC até': b.tratamento === TRATAMENTOS.STC ? data(b.janela?.fim) : '',
    Rota: rotaDescrita(b.config)
  });

  const agendaLinhas = [];
  agenda.filter(d => d.temTrabalho).forEach(d => d.linhas.forEach(b => agendaLinhas.push(linhaDeAgenda(d.dia, b))));
  if (depois?.temTrabalho) depois.linhas.forEach(b => agendaLinhas.push(linhaDeAgenda(null, b)));

  // Uma linha por RM, na ordem do serviço: o dia em que o lote chega —
  // que é o dia de prontificar —, depois o cliente, depois a data de
  // liberação.
  const itens = [];
  blocos.forEach(b => b.rms.forEach(r => itens.push({ ...r, dia: b.chegouEm, cam: b.cam, bloco: b })));
  itens.sort(porDiaCamLiberacao(indexarCams(itens)));

  const linhaDeRm = ({ rm, entrada, separadaEm, prazoDemanda, bloco: b }) => ({
    RM: rm,
    CAM: b.cam,
    Sigla: b.sigla || '',
    'Documento a lançar': b.documentoEsperado,
    'Separada em': data(separadaEm),
    'Prontificar até': data(b.prazo),
    'Entregar em': data(b.entregarEm),
    'Aprovar STC até': b.tratamento === TRATAMENTOS.STC ? data(b.janela?.fim) : '',
    'Data de liberação': data(entrada),
    'Prazo da demanda': data(prazoDemanda)
  });
  const rms = itens.map(i => ({
    'Chega na Expedição': data(i.dia),
    'Dia da semana': DIAS_SEMANA[new Date(i.dia + 'T00:00:00Z').getUTCDay()],
    ...linhaDeRm(i)
  }));

  // Uma aba por dia de chegada, na ordem em que os dias acontecem.
  const diasDeChegada = Array.from(new Set(itens.map(i => i.dia))).sort();
  const abasPorDia = diasDeChegada.map(dia => ({
    nome: abaDoDia(dia),
    linhas: itens.filter(i => i.dia === dia).map(linhaDeRm)
  }));

  const porCliente = new Map();
  blocos.forEach(b => {
    if (!porCliente.has(b.cam)) {
      porCliente.set(b.cam, {
        CAM: b.cam, Sigla: b.sigla || '', Tratamento: b.tratamento,
        'Documento a lançar': b.documentoEsperado, RMs: 0,
        'Chega em': b.chegouEm, 'Prontificar até': b.prazo,
        'Entregar em': b.entregarEm || '', 'Aprovar STC até': b.tratamento === TRATAMENTOS.STC ? (b.janela?.fim || '') : '',
        Rota: rotaDescrita(b.config)
      });
    }
    const l = porCliente.get(b.cam);
    l.RMs += b.qtd;
    if (b.chegouEm < l['Chega em']) l['Chega em'] = b.chegouEm;
    if (b.prazo < l['Prontificar até']) l['Prontificar até'] = b.prazo;
  });
  const indice = Array.from(porCliente.values())
    .sort((a, b) => b.RMs - a.RMs)
    .map(l => ({ ...l, 'Chega em': data(l['Chega em']), 'Prontificar até': data(l['Prontificar até']),
      'Entregar em': data(l['Entregar em']), 'Aprovar STC até': data(l['Aprovar STC até']) }));

  const sufixo = versao ? `_${sufixoDeArquivo(versao)}` : '';
  montarLivro([
    { nome: 'Resumo', linhas: resumoLinhas },
    { nome: 'Agenda', linhas: agendaLinhas },
    { nome: 'RMs', linhas: rms },
    ...abasPorDia,
    { nome: 'Por cliente', linhas: indice }
  ], `Programacao_Expedicao_${semanaRef}${sufixo}.xlsx`);
};

// ── Análise da fila ─────────────────────────────────────────────────
// Sai do arquivo do PWA, não de versão publicada: é o retrato de agora.
// A aba "Fila" tem uma linha por RM, mais antiga em cima.
export const exportarExcelFila = ({ analise, emitidoEm }) => {
  if (!analise) throw new Error('Sem fila para exportar.');

  const resumoLinhas = [
    { Campo: 'Emitido em', Valor: emitidoEm },
    { Campo: 'RMs na fila', Valor: analise.total },
    { Campo: 'Clientes na fila', Valor: analise.cams },
    { Campo: 'Idade média (dias)', Valor: analise.mediaDias ?? '' },
    { Campo: 'Idade mediana (dias)', Valor: analise.medianaDias ?? '' },
    { Campo: 'Maior espera (dias)', Valor: analise.maisAntiga?.dias ?? '' },
    { Campo: 'RM mais antiga', Valor: analise.maisAntiga?.rm || '' },
    { Campo: 'Sem data de liberação', Valor: analise.semData },
    { Campo: 'Reemitidas na fila', Valor: analise.reemitidas },
    { Campo: 'Semanas para zerar', Valor: analise.semanasParaZerar ?? '' },
    { Campo: 'Vazão medida por semana', Valor: analise.capacidadeSemana ?? '' },
    { Campo: 'RMs no arquivo do PWA', Valor: analise.totalNoArquivo }
  ];

  montarLivro([
    { nome: 'Resumo', linhas: resumoLinhas },
    {
      nome: 'Fila',
      linhas: analise.linhas.map(l => ({
        RM: l.rm,
        CAM: l.cam,
        Sigla: l.sigla,
        Situação: l.status,
        'Data de liberação': data(l.entrada),
        'Dias na fila': l.dias ?? '',
        'Último movimento': data(l.movimento),
        Tratamento: l.tratamento,
        'Tipo de RM': l.tipoRm,
        Documento: l.documento,
        Reemitida: l.reemitida ? 'sim' : ''
      }))
    },
    {
      nome: 'Por situação',
      linhas: analise.porStatus.map(s => ({
        Situação: s.status, RMs: s.qtd, '% da fila': s.pct,
        'Idade média (dias)': s.mediaDias ?? '', 'Maior espera (dias)': s.maiorEspera ?? ''
      }))
    },
    {
      nome: 'Por cliente',
      linhas: analise.porCliente.map(c => ({
        CAM: c.cam, Sigla: c.sigla, Tratamento: c.tratamento, RMs: c.qtd, '% da fila': c.pct,
        'Idade média (dias)': c.mediaDias ?? '', 'Maior espera (dias)': c.maiorEspera ?? ''
      }))
    },
    {
      nome: 'Idade da fila',
      linhas: analise.faixas.map(f => ({ Faixa: f.label, RMs: f.qtd, '% da fila': f.pct }))
    },
    {
      nome: 'Fora da fila',
      linhas: analise.foraDaFila.map(f => ({ Situação: f.status, RMs: f.qtd, 'Por que não entra': f.motivo }))
    }
  ], `Analise_da_Fila_${analise.hoje}.xlsx`);
};
