import { forwardRef, Fragment } from 'react';
import { Secao, Titulo, Tabela, Assinaturas } from './pecasDoDocumento';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana, diasUteisDaSemana } from '../../utils/programacao/semana';
import { roteiroDaSemana, janelasDaSemana } from '../../utils/programacao/expedicao';
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

const ExpedicaoDocument = forwardRef(({ filas, semanaRef, programador, encarregado, emitidoEm }, ref) => {
  if (!filas) return <div ref={ref} />;

  const dias = diasUteisDaSemana(semanaRef);
  const roteiro = roteiroDaSemana(filas, dias);
  const janelas = janelasDaSemana(filas, dias[0], dias[dias.length - 1]);
  const { resumo } = filas;

  // Só o que já passou do verde entra na parte de cobrança: listar o que
  // está no prazo encheria a página de linha sem ação.
  const cobrar = filas.cobranca.filter(d => d.nivel.key !== 'verde');

  const secoes = [];

  secoes.push(<Secao>
    <Titulo numero="1" texto="Situação da Expedição" />
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

  secoes.push(<Secao quebravel>
    <Titulo numero="2" texto="Roteiro de Entrega da Semana (GTC)" />
    <p className="text-[10px] text-slate-600" style={{ marginBottom: 9, lineHeight: '15px' }}>
      Entregas feitas pelo depósito, no dia de rota já estabelecido para cada CAM. &quot;Sem documento&quot; é o que precisa de
      mapa de carregamento e GTC antes da saída.
    </p>
    {roteiro.every(d => d.cams.length === 0)
      ? <p className="text-[10px] text-slate-500 italic">Nenhuma entrega nossa pendente nesta semana.</p>
      : roteiro.filter(d => d.cams.length > 0).map(d => (
          <div key={d.dia} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 4 }}>
              {DIAS_SEMANA[new Date(d.dia + 'T00:00:00Z').getUTCDay()]}, {formatarBr(d.dia)} — {d.cams.length} CAM(s), {d.aEntregar + d.aProntificar} RM(s)
            </p>
            <Tabela
              colunas={[
                { key: 'cam', label: 'CAM', width: '46%', emphasis: true },
                { key: 'entregar', label: 'Com GTC', width: '18%', align: 'center' },
                { key: 'prontificar', label: 'Sem documento', width: '20%', align: 'center' },
                { key: 'espera', label: 'Mais antiga', width: '16%', align: 'right' }
              ]}
              linhas={d.cams.map(g => ({
                cam: g.config.sigla ? `${g.config.sigla} — ${g.cam}` : g.cam,
                entregar: g.aEntregar.length || '—',
                prontificar: g.aProntificar.length || '—',
                espera: g.maisAntiga != null ? `${g.maisAntiga} dias` : '—'
              }))}
              rodape={{ cam: 'TOTAL DO DIA', entregar: d.aEntregar, prontificar: d.aProntificar, espera: '' }}
            />
          </div>
        ))}
  </Secao>);

  secoes.push(<Secao quebravel>
    <Titulo numero="3" texto="Prontificação de STC por Janela do CDAM" />
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
    <Titulo numero="4" texto="Pendências de Retirada — Cobrar o CDAM" />
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
    <Titulo numero={cobrar.length > 0 ? '5' : '4'} texto="CAMs sem Rota Cadastrada" />
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
  const anexo = [...filas.gtc, ...filas.stc, ...filas.semCadastro].filter(g => g.aProntificar.length + g.aEntregar.length > 0);

  return (
    <div ref={ref} className="bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Marinha do Brasil</p>
        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Depósito de Fardamento da Marinha no Rio de Janeiro</p>
        <h1 className="text-base font-black text-slate-900 uppercase tracking-wide" style={{ marginTop: 8 }}>Programação da Expedição</h1>
        <p className="text-xs font-bold text-slate-600" style={{ marginTop: 2 }}>Semana de {rotuloSemana(semanaRef)}</p>
        <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 14px', border: '1px solid #1e3a8a', borderRadius: 4 }}>
          <span className="text-[10px] font-black text-blue-900 uppercase tracking-wide">Emitido em {emitidoEm}</span>
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
              Semana de {rotuloSemana(semanaRef)} · emitido em {emitidoEm}
            </p>
            <div className="h-0.5 bg-slate-800" style={{ marginTop: 12 }} />
          </div>
          <p className="text-[10px] text-slate-600" style={{ marginBottom: 16, lineHeight: '15px' }}>
            Cada RM com o número de dias desde a conferência. Serve para conferir o que está fisicamente na Expedição
            contra o que este documento manda prontificar e entregar.
          </p>
          {anexo.map(g => (
            <div key={g.cam} style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 4 }}>
                {g.config.sigla ? `${g.config.sigla} — ` : ''}{g.cam}
                <span className="font-bold text-slate-500"> · {g.tratamento === 'GTC' ? `entrega nossa, ${rotaDescrita(g.config)}` : `retirada por terceiro, ${rotaDescrita(g.config)}`}</span>
              </p>
              <div className="h-px bg-slate-300" style={{ marginBottom: 6 }} />
              {g.aProntificar.length > 0 && (
                <p className="text-[9px] text-slate-600" style={{ lineHeight: '13px', marginBottom: 4, wordBreak: 'break-word' }}>
                  <strong className="text-slate-800">Sem documento ({g.aProntificar.length}):</strong>{' '}
                  {g.aProntificar.map(l => `${l.rm} (${l.dias ?? '?'}d)`).join(', ')}
                </p>
              )}
              {g.aEntregar.length > 0 && (
                <p className="text-[9px] text-slate-600" style={{ lineHeight: '13px', wordBreak: 'break-word' }}>
                  <strong className="text-slate-800">Com documento, a entregar ({g.aEntregar.length}):</strong>{' '}
                  {g.aEntregar.map(l => `${l.rm} (${l.documento})`).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ExpedicaoDocument.displayName = 'ExpedicaoDocument';
export default ExpedicaoDocument;
