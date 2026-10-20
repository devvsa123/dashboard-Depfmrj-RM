import { forwardRef, Fragment } from 'react';
import { Secao, Titulo, Tabela, Assinaturas, GradeDeRms } from './pecasDoDocumento';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana, diasUteisDaSemana } from '../../utils/programacao/semana';
import { janelasDaSemana } from '../../utils/programacao/expedicao';
import { rotaDescrita } from '../../utils/programacao/rotas';

// -----------------------------------------------------------------------
// Documento da Expedição. Irmão do documento da programação semanal, com
// um recorte diferente: a programação diz o que o depósito vai SEPARAR,
// este diz o que a Expedição vai ENTREGAR e PRONTIFICAR, respeitando as
// rotas já estabelecidas por CAM e as janelas de inserção de STC do CDAM.
//
// Um documento só, com três partes, porque as três respondem perguntas
// que a Expedição faz no mesmo momento: o que sai hoje, o que precisa de
// documento antes da janela fechar, e o que já está pronto apodrecendo
// no pátio à espera do CDAM.
// -----------------------------------------------------------------------

const ExpedicaoDocument = forwardRef(({ filas, projecao, semanaRef, programador, encarregado, emitidoEm, versao }, ref) => {
  if (!filas) return <div ref={ref} />;

  const dias = diasUteisDaSemana(semanaRef);
  const janelas = janelasDaSemana(filas, dias[0], dias[dias.length - 1]);
  const blocos = [...(projecao?.agenda || []), ...(projecao?.sobra ? [projecao.sobra] : [])];
  const { resumo } = filas;

  // Só o que já passou do verde entra na parte de cobrança: listar o que
  // está no prazo encheria a página de linha sem ação.
  const cobrar = filas.cobranca.filter(d => d.nivel.key !== 'verde');

  let n = 0;
  const num = () => String(++n);
  const secoes = [];

  secoes.push(<Secao>
    <Titulo numero={num()} texto="Situação da Expedição" />
    <div style={{ display: 'flex', gap: 10 }}>
      {[
        { r: 'A prontificar', v: resumo.aProntificar },
        { r: 'GTC a entregar', v: resumo.gtcAEntregar },
        { r: 'Aguardando retirada', v: resumo.stcACobrar },
        { r: 'Paradas +15 dias', v: resumo.vermelhos },
        { r: 'CAMs a fechar', v: resumo.camsAFechar }
      ].map(c => (
        <div key={c.r} style={{ flex: '1 1 0', minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 5, padding: '7px 9px', textAlign: 'center' }}>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">{c.r}</p>
          <p className="text-base font-black text-slate-900" style={{ lineHeight: '20px', marginTop: 2 }}>{c.v}</p>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-slate-600" style={{ marginTop: 10, lineHeight: '15px' }}>
      São {resumo.aProntificar} RM(s) conferidas esperando mapa de carregamento e documento. Dessas, as de entrega nossa saem
      pelas rotas da seção 2; as de retirada por terceiro precisam ter a STC lançada dentro da janela do CDAM, na seção 3.
      Outras {resumo.stcACobrar} RM(s) já estão com documento lançado e dependem apenas da retirada
      {resumo.vermelhos > 0 ? `, sendo ${resumo.vermelhos} paradas há mais de 15 dias` : ''}.
    </p>
  </Secao>);

  const colunasDaOrdem = [
    { key: 'ordem', label: '#', width: '6%', align: 'center' },
    { key: 'cam', label: 'CAM', width: '34%', emphasis: true },
    { key: 'porque', label: 'Por que nesta ordem', width: '42%' },
    { key: 'rms', label: 'RMs', width: '9%', align: 'center' },
    { key: 'atraso', label: 'Atrasadas', width: '9%', align: 'right' }
  ];

  const linhasDoBloco = (grupos) => grupos.map((g, i) => ({
    ordem: `${i + 1}º`,
    cam: g.sigla === g.cam ? g.cam : `${g.sigla} — ${g.cam}`,
    porque: g.urgencia.texto,
    rms: g.rms.length,
    atraso: g.atrasadas || '—'
  }));

  // A grade: uma linha por CAM, uma coluna por dia. É a visão que se lê
  // de longe, pregada na parede — o detalhe com a ordem de ataque vem na
  // seção seguinte.
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
    { key: 'cam', label: 'CAM', width: temProxima ? '34%' : '40%', emphasis: true },
    ...dias.map(d => ({ key: d, label: formatarCurto(d), width: temProxima ? '10%' : '11%', align: 'center' })),
    ...(temProxima ? [{ key: 'proxima', label: 'Seg seg.', width: '10%', align: 'center' }] : []),
    { key: 'total', label: 'Total', width: temProxima ? '6%' : '5%', align: 'right', emphasis: true }
  ];
  const linhasGrade = (linhas) => linhas.map(l => ({
    cam: l.sigla === l.cam ? l.cam : `${l.sigla} — ${l.cam}`,
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

  const gradeGtc = montaGrade(b => b.gtc);
  const gradeStc = montaGrade(b => b.stc);
  const gradeSem = montaGrade(b => b.semRota);

  if (blocos.length > 0) secoes.push(<Secao quebravel>
    <Titulo numero={num()} texto="Grade de Prontificação da Semana" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      Quantas RMs de cada CAM a Expedição recebe em cada dia. GTC e STC vêm em blocos separados porque o trabalho é
      diferente: a GTC termina no caminhão, a STC termina no lançamento do documento.
    </p>
    {[
      { titulo: 'GTC — entrega nossa', linhas: gradeGtc },
      { titulo: 'STC — lançar e aguardar o CDAM', linhas: gradeStc },
      { titulo: 'Sem rota cadastrada', linhas: gradeSem }
    ].filter(b => b.linhas.length > 0).map(b => (
      <div key={b.titulo} style={{ marginBottom: 9 }}>
        <Tabela titulo={b.titulo} colunas={colunasGrade} linhas={linhasGrade(b.linhas)} rodape={rodapeGrade(b.linhas)} quebravel />
      </div>
    ))}
  </Secao>);

  secoes.push(<Secao quebravel>
    <Titulo numero={num()} texto="Prontificação Dia a Dia" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      O que a Expedição recebe em cada dia e em que ordem atacar. O que a separação conclui num dia fica disponível no
      dia útil seguinte — por isso o que for separado na sexta aparece na segunda. A ordem dentro do dia é a mesma régua
      da separação: CAM forçado na frente, depois quem vence primeiro, antiguidade no fim.
      {projecao?.temPlano ? '' : ' A programação da separação desta semana ainda não foi publicada, então abaixo consta apenas o que já está conferido esperando documento.'}
    </p>
    {blocos.length === 0
      ? <p className="text-[10px] text-slate-500 italic">Nada a prontificar nesta semana.</p>
      : blocos.map(bloco => (
          <div key={bloco.dia || 'proxima'} style={{ breakInside: 'avoid', marginBottom: 14 }}>
            <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5, breakAfter: 'avoid' }}>
              {bloco.proximaSemana
                ? `Segunda seguinte — ${bloco.total} RM(s)`
                : `${DIAS_SEMANA[new Date(bloco.dia + 'T00:00:00Z').getUTCDay()]}, ${formatarBr(bloco.dia)} — ${bloco.total} RM(s)`}
            </p>
            {[
              { titulo: 'GTC — entrega nossa', grupos: bloco.gtc },
              { titulo: 'STC — lançar e aguardar o CDAM', grupos: bloco.stc },
              { titulo: 'Sem rota cadastrada', grupos: bloco.semRota }
            ].filter(b => b.grupos.length > 0).map(b => (
              <div key={b.titulo} style={{ marginBottom: 7 }}>
                <Tabela titulo={b.titulo} colunas={colunasDaOrdem} linhas={linhasDoBloco(b.grupos)} quebravel />
              </div>
            ))}
          </div>
        ))}
  </Secao>);

  secoes.push(<Secao quebravel>
    <Titulo numero={num()} texto="Fechamento das STC por Janela do CDAM" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      Para cada CAM, o processo só fecha quando a STC está lançada em todas as RM não canceladas. &quot;Faltam&quot; é o que ainda
      está conferido sem documento; a coluna seguinte mostra o que ainda depende da separação e entrará depois.
    </p>
    {janelas.length === 0
      ? <p className="text-[10px] text-slate-500 italic">Nenhum CAM de STC com pendência.</p>
      : <Tabela
          quebravel
          colunas={[
            { key: 'cam', label: 'CAM', width: '34%', emphasis: true },
            { key: 'janela', label: 'Janela do CDAM', width: '20%', align: 'center' },
            { key: 'faltam', label: 'Faltam lançar', width: '15%', align: 'center' },
            { key: 'separacao', label: 'Na separação', width: '14%', align: 'center' },
            { key: 'lancadas', label: 'Já lançadas', width: '17%', align: 'right' }
          ]}
          linhas={janelas.map(g => ({
            cam: `${g.config.sigla ? `${g.config.sigla} — ` : ''}${g.cam}${g.nestaSemana ? ' (janela nesta semana)' : ''}`,
            janela: g.janela ? `${formatarCurto(g.janela.inicio)} a ${formatarCurto(g.janela.fim)}` : rotaDescrita(g.config),
            faltam: g.faltamFechar || '—',
            separacao: g.naSeparacao || '—',
            lancadas: g.inseridas.length || '—'
          }))}
          rodape={{
            cam: 'TOTAL',
            janela: '',
            faltam: janelas.reduce((t, g) => t + g.faltamFechar, 0),
            separacao: janelas.reduce((t, g) => t + g.naSeparacao, 0),
            lancadas: janelas.reduce((t, g) => t + g.inseridas.length, 0)
          }}
        />}
  </Secao>);

  if (cobrar.length > 0) secoes.push(<Secao quebravel>
    <Titulo numero={num()} texto="Pendências de Retirada — Cobrar o CDAM" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      Documentos já lançados, com o material pronto e sem retirada. O prazo é contado da conferência. Até 7 dias a
      situação é normal; de 8 a 15 dias cabe aviso; acima de 15 dias cabe cobrança formal.
    </p>
    <Tabela
      quebravel
      colunas={[
        { key: 'doc', label: 'Documento', width: '20%', emphasis: true },
        { key: 'cam', label: 'CAM', width: '38%' },
        { key: 'rms', label: 'RMs', width: '10%', align: 'center' },
        { key: 'desde', label: 'Pronto desde', width: '17%', align: 'center' },
        { key: 'dias', label: 'Parado', width: '15%', align: 'right' }
      ]}
      linhas={cobrar.map(d => ({
        doc: d.documento,
        cam: d.sigla === d.cam ? d.cam : `${d.sigla} — ${d.cam}`,
        rms: d.qtd,
        desde: d.desde ? formatarBr(d.desde) : '—',
        dias: `${d.dias} dias${d.nivel.key === 'vermelho' ? ' *' : ''}`
      }))}
      rodape={{ doc: 'TOTAL', cam: '', rms: cobrar.reduce((t, d) => t + d.qtd, 0), desde: '', dias: '' }}
    />
    <p className="text-[9px] text-slate-500" style={{ marginTop: 6 }}>
      * acima de 15 dias parados — cobrança formal ao CDAM.
    </p>
  </Secao>);

  if (filas.semCadastro.length > 0) secoes.push(<Secao>
    <Titulo numero={num()} texto="CAMs sem Rota Cadastrada" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      Têm material parado na Expedição mas ainda não foram classificados como entrega nossa ou retirada por terceiro.
      Enquanto isso não for definido, não entram no roteiro acima.
    </p>
    <Tabela
      colunas={[
        { key: 'cam', label: 'CAM', width: '62%', emphasis: true },
        { key: 'rms', label: 'RMs paradas', width: '20%', align: 'center' },
        { key: 'espera', label: 'Mais antiga', width: '18%', align: 'right' }
      ]}
      linhas={filas.semCadastro.map(g => ({
        cam: g.cam,
        rms: g.aProntificar.length + g.aEntregar.length,
        espera: g.maisAntiga != null ? `${g.maisAntiga} dias` : '—'
      }))}
    />
  </Secao>);

  // Anexo: as RMs, por CAM. É o que a Expedição usa para conferir o que
  // tem em mãos contra o que o documento manda sair.
  // Anexo A é o que a Expedição tem de FAZER. O que ela tem de COBRAR
  // vai no Anexo B: são listas com donos diferentes, e misturá-las
  // obrigava quem carrega o caminhão a folhear páginas de pendência do
  // CDAM para achar a própria.
  const anexo = [...filas.gtc, ...filas.stc, ...filas.semCadastro]
    .filter(g => g.aProntificar.length + g.aEntregar.length > 0);

  // Anexo B: documentos lançados esperando retirada, já fora do verde.
  const anexoCobranca = cobrar.map(d => {
    const grupo = filas.grupos.find(g => g.cam === d.cam);
    const rms = (grupo?.inseridas || []).filter(l => String(l.documento || '').trim().toUpperCase() === String(d.documento || '').trim().toUpperCase());
    return { ...d, rms };
  }).filter(d => d.rms.length > 0);

  return (
    <div ref={ref} className="bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Marinha do Brasil</p>
        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Depósito de Fardamento da Marinha no Rio de Janeiro</p>
        <h1 className="text-base font-black text-slate-900 uppercase tracking-wide" style={{ marginTop: 8 }}>Programação da Expedição</h1>
        <p className="text-xs font-bold text-slate-600" style={{ marginTop: 2 }}>Semana de {rotuloSemana(semanaRef)}</p>
        <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 14px', border: '1px solid #1e3a8a', borderRadius: 4 }}>
          <span className="text-[10px] font-black text-blue-900 uppercase tracking-wide">
            {versao ? `${versao} · emitido em ${emitidoEm}` : `Emitido em ${emitidoEm}`}
          </span>
        </div>
        <div className="h-0.5 bg-slate-800" style={{ marginTop: 10 }} />
      </div>

      {secoes.map((sec, i) => (
        i === secoes.length - 1
          ? <div key={i} style={{ breakInside: 'avoid' }}>
              {sec}
              <Assinaturas programador={programador} encarregado={encarregado} />
            </div>
          : <Fragment key={i}>{sec}</Fragment>
      ))}

      {anexo.length > 0 && (
        <div style={{ breakBefore: 'page', paddingTop: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">Anexo A — Relação das RMs por CAM</h1>
            <p className="text-[10px] text-slate-500" style={{ marginTop: 3 }}>
              Semana de {rotuloSemana(semanaRef)}{versao ? ` · ${versao}` : ''} · emitido em {emitidoEm}
            </p>
            <div className="h-0.5 bg-slate-800" style={{ marginTop: 12 }} />
          </div>
          <p className="text-[10px] text-slate-600" style={{ marginBottom: 16, lineHeight: '15px' }}>
            Por CAM: primeiro o que ainda não tem documento, com os dias de espera de cada RM; depois cada GTC já
            lançada e ainda não expedida, com as RMs que ela carrega. Serve para conferir o que está fisicamente na
            Expedição contra o que este documento manda prontificar e entregar. Os documentos que só dependem da
            retirada estão no Anexo B.
          </p>
          {anexo.map(g => {
            // Agrupa por DOCUMENTO em vez de repetir o número da GTC ao
            // lado de cada RM: numa GTC com 113 RMs, o número aparecia
            // 113 vezes e o que importa — qual documento carregar — se
            // perdia no meio dos oito dígitos.
            const docs = new Map();
            g.aEntregar.forEach(l => {
              const chave = String(l.documento || '').trim() || '(sem número)';
              if (!docs.has(chave)) docs.set(chave, { documento: chave, tipo: l.tipoDoc, rms: [], dias: 0 });
              const d = docs.get(chave);
              d.rms.push(l);
              if ((l.dias ?? 0) > d.dias) d.dias = l.dias ?? 0;
            });
            const documentos = Array.from(docs.values()).sort((a, b) => b.rms.length - a.rms.length);

            return (
              <div key={g.cam} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 4, breakAfter: 'avoid' }}>
                  {g.config.sigla ? `${g.config.sigla} — ` : ''}{g.cam}
                  <span className="font-bold text-slate-500"> · {g.tratamento === 'GTC' ? `entrega nossa, ${rotaDescrita(g.config)}` : `retirada por terceiro, ${rotaDescrita(g.config)}`}</span>
                </p>
                <div className="h-px bg-slate-300" style={{ marginBottom: 6 }} />

                {g.aProntificar.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wide" style={{ marginBottom: 2 }}>
                      Sem documento — {g.aProntificar.length} RM(s)
                    </p>
                    <GradeDeRms itens={g.aProntificar.map(l => ({ rm: l.rm, nota: l.dias != null ? `${l.dias}d` : '' }))} colunas={6} />
                  </div>
                )}

                {documentos.map(d => (
                  <div key={d.documento} style={{ marginBottom: 8, breakInside: 'avoid' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: '1px solid #cbd5e1', paddingBottom: 2, marginBottom: 2 }}>
                      <span className="text-[11px] font-black text-slate-900">{d.documento}</span>
                      <span className="text-[9px] font-bold text-slate-500">{d.tipo || ''}</span>
                      <span className="text-[9px] text-slate-500">{d.rms.length} RM(s)</span>
                      {d.dias > 0 && <span className="text-[9px] text-slate-400">parado há {d.dias} dias</span>}
                    </div>
                    <GradeDeRms itens={d.rms.map(l => ({ rm: l.rm }))} colunas={6} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────── ANEXO B ───────────────── */}
      {anexoCobranca.length > 0 && (
        <div style={{ breakBefore: 'page', paddingTop: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">Anexo B — Documentos Aguardando Retirada</h1>
            <p className="text-[10px] text-slate-500" style={{ marginTop: 3 }}>
              Semana de {rotuloSemana(semanaRef)}{versao ? ` · ${versao}` : ''} · emitido em {emitidoEm}
            </p>
            <div className="h-0.5 bg-slate-800" style={{ marginTop: 12 }} />
          </div>
          <p className="text-[10px] text-slate-600" style={{ marginBottom: 16, lineHeight: '15px' }}>
            Cada documento já lançado e parado há mais de 7 dias, com as RMs que ele carrega. É a lista de cobrança: o
            material está pronto e o que falta não depende do depósito. Os documentos no prazo não entram aqui.
          </p>
          {anexoCobranca.map(d => (
            <div key={d.documento} style={{ marginBottom: 10, breakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: '1px solid #cbd5e1', paddingBottom: 2, marginBottom: 2 }}>
                <span className="text-[11px] font-black text-slate-900">{d.documento}</span>
                <span className="text-[9px] font-bold text-slate-500">{d.sigla}</span>
                <span className="text-[9px] text-slate-500">{d.rms.length} RM(s)</span>
                <span className="text-[9px] font-bold" style={{ color: d.nivel.key === 'vermelho' ? '#dc2626' : '#d97706' }}>
                  parado há {d.dias} dias
                </span>
              </div>
              <GradeDeRms itens={d.rms.map(l => ({ rm: l.rm }))} colunas={6} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ExpedicaoDocument.displayName = 'ExpedicaoDocument';
export default ExpedicaoDocument;
