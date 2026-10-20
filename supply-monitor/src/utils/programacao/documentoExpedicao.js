import { criarDocumento, AZUL, TINTA, SUAVE, VERMELHO, AMBAR } from './pdfTexto';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana, diasUteisDaSemana } from './semana';
import { janelasDaSemana } from './expedicao';
import { rotaDescrita } from './rotas';

// -----------------------------------------------------------------------
// Documento da Expedição. A programação diz o que o depósito vai SEPARAR;
// este diz o que a Expedição vai PRONTIFICAR e ENTREGAR, respeitando as
// rotas de cada CAM e as janelas de inserção de STC do CDAM.
//
// Escrito como texto, não como imagem da página: com os números reais da
// operação o documento passa de cinquenta páginas, e nenhum canvas de
// navegador aguenta isso (ver pdfTexto.js).
// -----------------------------------------------------------------------

const rotuloDoDia = (bloco) => (bloco.proximaSemana
  ? `Segunda seguinte — ${bloco.total} RM(s)`
  : `${DIAS_SEMANA[new Date(bloco.dia + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(bloco.dia)} — ${bloco.total} RM(s)`);

const nomeDoCam = (g) => (g.sigla && g.sigla !== g.cam ? `${g.sigla} — ${g.cam}` : g.cam);

export const gerarPdfExpedicao = ({ filas, projecao, semanaRef, programador, encarregado, versao, emitidoEm }) => {
  if (!filas) throw new Error('Sem dados da Expedição para gerar o documento.');

  const dias = diasUteisDaSemana(semanaRef);
  const janelas = janelasDaSemana(filas, dias[0], dias[dias.length - 1]);
  const blocos = [...(projecao?.agenda || []), ...(projecao?.sobra ? [projecao.sobra] : [])];
  const { resumo } = filas;

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
    `São ${resumo.aProntificar} RM(s) conferidas esperando mapa de carregamento e documento. Dessas, as de entrega nossa `
    + 'saem pelas rotas da seção 3; as de retirada por terceiro precisam ter a STC lançada dentro da janela do CDAM, na '
    + `seção 4. Outras ${resumo.stcACobrar} RM(s) já estão com documento lançado e dependem apenas da retirada`
    + (resumo.vermelhos > 0 ? `, sendo ${resumo.vermelhos} paradas há mais de 15 dias` : '') + '.'
  );

  // ── 2. A grade ────────────────────────────────────────────────────
  const montaGrade = (pegar) => {
    const linhas = new Map();
    blocos.forEach(bloco => pegar(bloco).forEach(g => {
      if (!linhas.has(g.cam)) linhas.set(g.cam, { cam: g.cam, sigla: g.sigla, porDia: {}, total: 0 });
      const l = linhas.get(g.cam);
      const chave = bloco.dia || 'proxima';
      l.porDia[chave] = (l.porDia[chave] || 0) + g.rms.length;
      l.total += g.rms.length;
    }));
    return Array.from(linhas.values()).sort((a, b) => b.total - a.total);
  };
  const temProxima = blocos.some(b => b.proximaSemana);
  const colunasGrade = [
    { key: 'cam', label: 'CAM', largura: temProxima ? 0.34 : 0.40, forte: true },
    ...dias.map(d => ({ key: d, label: formatarCurto(d), largura: temProxima ? 0.10 : 0.11, align: 'center' })),
    ...(temProxima ? [{ key: 'proxima', label: 'Seg seg.', largura: 0.10, align: 'center' }] : []),
    { key: 'total', label: 'Total', largura: temProxima ? 0.06 : 0.05, align: 'right', forte: true }
  ];
  const linhasGrade = (linhas) => linhas.map(l => ({
    cam: nomeDoCam(l),
    ...Object.fromEntries(dias.map(d => [d, l.porDia[d] || '—'])),
    ...(temProxima ? { proxima: l.porDia.proxima || '—' } : {}),
    total: l.total
  }));
  const rodapeGrade = (linhas) => ({
    cam: 'TOTAL',
    ...Object.fromEntries(dias.map(d => [d, linhas.reduce((t, l) => t + (l.porDia[d] || 0), 0) || '—'])),
    ...(temProxima ? { proxima: linhas.reduce((t, l) => t + (l.porDia.proxima || 0), 0) || '—' } : {}),
    total: linhas.reduce((t, l) => t + l.total, 0)
  });

  const gradesPorTipo = [
    { titulo: 'GTC — entrega nossa', linhas: montaGrade(b => b.gtc) },
    { titulo: 'STC — lançar e aguardar o CDAM', linhas: montaGrade(b => b.stc) },
    { titulo: 'Sem rota cadastrada', linhas: montaGrade(b => b.semRota) }
  ].filter(b => b.linhas.length > 0);

  if (blocos.length > 0) {
    p.secao(num(), 'Grade de Prontificação da Semana');
    p.paragrafo('Quantas RMs de cada CAM a Expedição recebe em cada dia. GTC e STC vêm em blocos separados porque o '
      + 'trabalho é diferente: a GTC termina no caminhão, a STC termina no lançamento do documento.');
    gradesPorTipo.forEach(b => p.tabela({
      titulo: b.titulo, colunas: colunasGrade, linhas: linhasGrade(b.linhas), rodape: rodapeGrade(b.linhas)
    }));
  }

  // ── 3. Dia a dia ──────────────────────────────────────────────────
  const colunasDaOrdem = [
    { key: 'ordem', label: '#', largura: 0.06, align: 'center' },
    { key: 'cam', label: 'CAM', largura: 0.34, forte: true },
    { key: 'porque', label: 'Por que nesta ordem', largura: 0.42 },
    { key: 'rms', label: 'RMs', largura: 0.09, align: 'center' },
    { key: 'atraso', label: 'Atrasadas', largura: 0.09, align: 'right' }
  ];

  p.secao(num(), 'Prontificação Dia a Dia');
  p.paragrafo('O que a Expedição recebe em cada dia e em que ordem atacar. O que a separação conclui num dia fica '
    + 'disponível no dia útil seguinte — por isso o que for separado na sexta aparece na segunda. A ordem dentro do dia '
    + 'é a mesma régua da separação: CAM forçado na frente, depois quem vence primeiro, antiguidade no fim.'
    + (projecao?.temPlano ? '' : ' A programação da separação desta semana ainda não foi publicada, então abaixo consta '
      + 'apenas o que já está conferido esperando documento.'));

  if (blocos.length === 0) {
    p.paragrafo('Nada a prontificar nesta semana.', { estilo: 'italic' });
  } else {
    blocos.forEach(bloco => {
      p.reservar(28);
      p.texto(rotuloDoDia(bloco), { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1.5 });
      [
        { titulo: 'GTC — entrega nossa', grupos: bloco.gtc },
        { titulo: 'STC — lançar e aguardar o CDAM', grupos: bloco.stc },
        { titulo: 'Sem rota cadastrada', grupos: bloco.semRota }
      ].filter(b => b.grupos.length > 0).forEach(b => p.tabela({
        titulo: b.titulo,
        colunas: colunasDaOrdem,
        espacoDepois: 2.5,
        linhas: b.grupos.map((g, i) => ({
          ordem: `${i + 1}º`,
          cam: nomeDoCam(g),
          porque: g.urgencia.texto,
          rms: g.rms.length,
          atraso: g.atrasadas || '—'
        }))
      }));
      p.y += 2;
    });
  }

  // ── 4. Janelas ────────────────────────────────────────────────────
  p.secao(num(), 'Fechamento das STC por Janela do CDAM');
  p.paragrafo('Para cada CAM, o processo só fecha quando a STC está lançada em todas as RM não canceladas. "Faltam" é o '
    + 'que ainda está conferido sem documento; a coluna seguinte mostra o que ainda depende da separação e entrará '
    + 'depois. A ordem é a do fechamento da janela: quem fecha antes vem antes, mesmo que a janela termine antes desta '
    + 'semana começar — aí o prazo já está correndo e perdê-lo significa esperar o mês seguinte.');
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
    p.paragrafo('Documentos já lançados, com o material pronto e sem retirada. O prazo é contado da conferência. Até 7 '
      + 'dias a situação é normal; de 8 a 15 dias cabe aviso; acima de 15 dias cabe cobrança formal.');
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
    p.paragrafo('Têm material parado na Expedição mas ainda não foram classificados como entrega nossa ou retirada por '
      + 'terceiro. Enquanto isso não for definido, não entram no roteiro acima.');
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

  // ── Anexo A: o trabalho da Expedição ──────────────────────────────
  const anexo = [...filas.gtc, ...filas.stc, ...filas.semCadastro]
    .filter(g => g.aProntificar.length + g.aEntregar.length > 0);

  if (anexo.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO A — RELAÇÃO DAS RMS POR CAM',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Por CAM: primeiro o que ainda não tem documento, com os dias de espera de cada RM; depois cada GTC já '
      + 'lançada e ainda não expedida, com as RMs que ela carrega. Serve para conferir o que está fisicamente na '
      + 'Expedição contra o que este documento manda prontificar e entregar. Os documentos que só dependem da retirada '
      + 'estão no Anexo B.');

    anexo.forEach(g => {
      // Agrupa por DOCUMENTO em vez de repetir o número da GTC ao lado de
      // cada RM: numa GTC com 113 RMs o número aparecia 113 vezes.
      const docs = new Map();
      g.aEntregar.forEach(l => {
        const chave = String(l.documento || '').trim() || '(sem número)';
        if (!docs.has(chave)) docs.set(chave, { documento: chave, tipo: l.tipoDoc, rms: [], dias: 0 });
        const d = docs.get(chave);
        d.rms.push(l);
        if ((l.dias ?? 0) > d.dias) d.dias = l.dias ?? 0;
      });
      const documentos = Array.from(docs.values()).sort((a, b) => b.rms.length - a.rms.length);

      p.reservar(24);
      p.texto(`${nomeDoCam(g)}  ·  ${g.tratamento === 'GTC' ? `entrega nossa, ${rotaDescrita(g.config)}` : `retirada por terceiro, ${rotaDescrita(g.config)}`}`,
        { tamanho: 9, estilo: 'bold', cor: TINTA, espacoDepois: 1 });
      p.regua([203, 213, 225], 0.2, 1.5);

      if (g.aProntificar.length > 0) {
        p.texto(`Sem documento — ${g.aProntificar.length} RM(s)`, { tamanho: 7.5, estilo: 'bold', cor: SUAVE, espacoDepois: 0.5 });
        p.gradeDeRms(g.aProntificar.map(l => ({ rm: l.rm, nota: l.dias != null ? `${l.dias}d` : '' })));
      }
      documentos.forEach(d => {
        p.reservar(14);
        p.texto(`${d.documento}   ${d.tipo || ''}   ${d.rms.length} RM(s)${d.dias > 0 ? `   parado há ${d.dias} dias` : ''}`,
          { tamanho: 8.5, estilo: 'bold', cor: AZUL, espacoDepois: 0.5 });
        p.gradeDeRms(d.rms.map(l => ({ rm: l.rm })));
      });
      p.y += 2;
    });
  }

  // ── Anexo B: a cobrança ───────────────────────────────────────────
  const anexoCobranca = cobrar.map(d => {
    const grupo = filas.grupos.find(g => g.cam === d.cam);
    const rms = (grupo?.inseridas || []).filter(l =>
      String(l.documento || '').trim().toUpperCase() === String(d.documento || '').trim().toUpperCase());
    return { ...d, listaRms: rms };
  }).filter(d => d.listaRms.length > 0);

  if (anexoCobranca.length > 0) {
    p.tituloDeAnexo({
      titulo: 'ANEXO B — DOCUMENTOS AGUARDANDO RETIRADA',
      subtitulo: `Semana de ${rotuloSemana(semanaRef)}${versao ? ` · ${versao}` : ''} · emitido em ${emitidoEm}`
    });
    p.paragrafo('Cada documento já lançado e parado há mais de 7 dias, com as RMs que ele carrega. É a lista de '
      + 'cobrança: o material está pronto e o que falta não depende do depósito. Os documentos no prazo não entram aqui.');
    anexoCobranca.forEach(d => {
      p.reservar(14);
      p.texto(`${d.documento}   ${d.sigla}   ${d.listaRms.length} RM(s)   parado há ${d.dias} dias`,
        { tamanho: 8.5, estilo: 'bold', cor: d.nivel.key === 'vermelho' ? VERMELHO : AMBAR, espacoDepois: 0.5 });
      p.gradeDeRms(d.listaRms.map(l => ({ rm: l.rm })));
    });
  }

  const sufixo = versao ? `_${versao.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
  p.salvar(`Programacao_Expedicao_${semanaRef}${sufixo}.pdf`);
};
