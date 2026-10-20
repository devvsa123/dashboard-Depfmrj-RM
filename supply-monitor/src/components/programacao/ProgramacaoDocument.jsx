import { forwardRef, Fragment } from 'react';
import { DIAS_SEMANA, formatarBr, formatarCurto, rotuloSemana } from '../../utils/programacao/semana';
import { ORIGENS, limiteDeSeparacao } from '../../utils/programacao/motor';
import { agruparParaAnexo } from '../../utils/programacao/versoes';
import { Secao, Titulo, Tabela, Assinaturas } from './pecasDoDocumento';

// -----------------------------------------------------------------------
// Documento estático da programação semanal. Como o relatório mensal, não
// reaproveita os cartões da tela: é uma renderização paralela pensada para
// ser lida em papel e assinada. Fica fora da tela e só é capturada na hora
// de gerar o PDF.
//
// Tabelas em flexbox, e não <table>: o html2canvas respeita mal a largura
// de coluna de tabelas HTML e corta a última coluna na borda da página.
// As larguras precisam somar exatamente 100%, porque cada coluna é
// `flex: 0 0 X%`.
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

const ProgramacaoDocument = forwardRef(({ snapshot, diff, semanaRef, programador, encarregado, versao, emitidoEm }, ref) => {
  if (!snapshot) return <div ref={ref} />;
  const { grade, porCam, resumo, alertas, bloqueios } = snapshot;

  // Grade por CAM: 5 dias + CAM + total. As larguras somam exatamente 100%.
  const colsCam = [
    { key: 'cam', label: 'CAM', width: '34%', emphasis: true },
    ...grade.map(s => ({ key: s.dia, label: formatarCurto(s.dia), width: '11%', align: 'center' })),
    { key: 'total', label: 'Total', width: '11%', align: 'right', emphasis: true }
  ];
  const linhasCam = porCam.map(l => ({
    cam: l.cam,
    ...Object.fromEntries(grade.map(s => [s.dia, l.porDia[s.dia] || '—'])),
    total: l.total
  }));
  const rodapeCam = {
    cam: 'TOTAL',
    ...Object.fromEntries(grade.map(s => [s.dia, s.alocacoes.length])),
    total: resumo.totalProgramado
  };

  const comPrazo = snapshot.demandas || [];

  // Anexo: agrupa por dia, depois por origem e CAM. Listar 400 linhas uma a
  // uma não se lê; agrupado, cada linha já traz o porquê de todas as RMs
  // daquele bloco.
  const anexo = grade.filter(s => s.alocacoes.length).map(slot => {
    const grupos = new Map();
    slot.alocacoes.forEach(a => {
      const cam = a.cam || '(sem CAM)';
      // Na fila por antiguidade a justificativa carrega os dias de cada RM,
      // então agrupar por ela devolveria um grupo por RM. O que interessa
      // ali é o CAM e a faixa de espera, resumida depois.
      const chave = ehFila(a.origem) ? `FILA||${cam}` : `${a.justificativa}||${cam}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, { justificativa: a.justificativa, cam, origem: a.origem, rms: [], dias: [] });
      }
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

  const secoes = [];
    secoes.push(<Secao>
        <Titulo numero="1" texto="Resumo da Semana" />
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { r: 'RMs programadas', v: resumo.totalProgramado },
            { r: 'Capacidade da semana', v: resumo.capacidadeTotal },
            { r: 'Ocupação', v: `${resumo.ocupacao}%` },
            { r: 'Com prazo', v: resumo.comPrazo },
            { r: 'CAMs atendidos', v: resumo.camsAtendidos }
          ].map(c => (
            <div key={c.r} style={{ flex: '1 1 0', minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 5, padding: '7px 9px', textAlign: 'center' }}>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">{c.r}</p>
              <p className="text-base font-black text-slate-900" style={{ lineHeight: '20px', marginTop: 2 }}>{c.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600" style={{ marginTop: 10, lineHeight: '15px' }}>
          Das {resumo.totalProgramado} RMs programadas, {resumo.comPrazo} atendem demanda com prazo definido
          {resumo.porRota ? `, ${resumo.porRota} foram alocadas para pegar a rota do próprio CAM dentro da semana` : ''} e
          {' '}{resumo.porAntiguidade} saem da fila por antiguidade. A fila de separação soma {resumo.filaTotal} RMs — pedidos
          que ainda dependem de trabalho do depósito, sem contar os já conferidos e entregues à Expedição.
        </p>
    </Secao>);

    secoes.push(<Secao quebravel>
        <Titulo numero="2" texto="Grade de Atendimento por CAM" />
        <Tabela colunas={colsCam} linhas={linhasCam} rodape={rodapeCam} quebravel />
    </Secao>);

      if (bloqueios.length > 0)       secoes.push(<Secao>
          <Titulo numero="3" texto="Dias sem Separação" />
          <Tabela
            colunas={[
              { key: 'data', label: 'Data', width: '22%', emphasis: true },
              { key: 'dia', label: 'Dia da semana', width: '26%' },
              { key: 'motivo', label: 'Motivo', width: '52%' }
            ]}
            linhas={bloqueios.map(b => ({
              data: formatarBr(b.data),
              dia: DIAS_SEMANA[new Date(b.data + 'T00:00:00Z').getUTCDay()],
              motivo: b.motivo
            }))}
          />
      </Secao>);

      if (comPrazo.length > 0)       secoes.push(<Secao>
          <Titulo numero={bloqueios.length > 0 ? '4' : '3'} texto="Demandas com Prazo" />
          <Tabela
            colunas={[
              { key: 'ref', label: 'Origem / Referência', width: '36%', emphasis: true },
              { key: 'rms', label: 'RMs informadas', width: '16%', align: 'center' },
              { key: 'prazo', label: 'Prazo', width: '16%', align: 'center' },
              { key: 'limite', label: 'Separar até', width: '16%', align: 'center' },
              { key: 'exp', label: 'Dias exped.', width: '16%', align: 'center' }
            ]}
            linhas={comPrazo.map(d => ({
              ref: `${ORIGEM_LABEL[d.origem] || d.origem}${d.referencia ? ` — ${d.referencia}` : ''}`,
              rms: d.qtd,
              prazo: formatarBr(d.prazo),
              limite: formatarBr(limiteDeSeparacao(d.prazo, d.diasExpedicao)),
              exp: `${d.diasExpedicao} úteis`
            }))}
          />
      </Secao>);

      if (alertas.length > 0)       secoes.push(<Secao>
          <Titulo numero={[bloqueios.length > 0, comPrazo.length > 0].filter(Boolean).length + 3} texto="Observações" />
          {alertas.map((a, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${a.nivel === 'critico' ? '#dc2626' : '#d97706'}`, padding: '3px 0 3px 10px', marginBottom: 6, breakInside: 'avoid' }}>
              <p className="text-[10px] text-slate-700" style={{ lineHeight: '14px' }}>{a.texto}</p>
            </div>
          ))}
      </Secao>);


  return (
    <div ref={ref} style={{ width: '100%', background: '#fff', padding: '4px 0', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Marinha do Brasil</p>
        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Depósito de Fardamento da Marinha no Rio de Janeiro</p>
        <h1 className="text-base font-black text-slate-900 uppercase tracking-wide" style={{ marginTop: 8 }}>Programação Semanal de Atendimento</h1>
        <p className="text-xs font-bold text-slate-600" style={{ marginTop: 2 }}>Semana de {rotuloSemana(semanaRef)}</p>
        <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 14px', border: '1px solid #1e3a8a', borderRadius: 4 }}>
          <span className="text-[10px] font-black text-blue-900 uppercase tracking-wide">{versao}</span>
        </div>
        <div className="h-0.5 bg-slate-800" style={{ marginTop: 10 }} />
      </div>

      {secoes.map((sec, i) => (
        i === secoes.length - 1
          // A assinatura nunca pode cair sozinha numa página: ela vai
          // dentro do mesmo bloco da última seção, que já é indivisível.
          ? <div key={i} style={{ breakInside: 'avoid' }}>
              {sec}
              <Assinaturas programador={programador} encarregado={encarregado} />
            </div>
          : <Fragment key={i}>{sec}</Fragment>
      ))}

      {/* ───────────────── ANEXO A ───────────────── */}
      <div style={{ breakBefore: 'page', paddingTop: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">Anexo A — Detalhamento do Atendimento</h1>
          <p className="text-[10px] text-slate-500" style={{ marginTop: 3 }}>
            Semana de {rotuloSemana(semanaRef)} · {versao} · emitido em {emitidoEm}
          </p>
          <div className="h-0.5 bg-slate-800" style={{ marginTop: 12 }} />
        </div>
        <p className="text-[10px] text-slate-600" style={{ marginBottom: 16, lineHeight: '15px' }}>
          Relação das RMs programadas, por dia, com a razão de cada bloco estar na grade. As RMs de uma mesma origem e
          mesmo CAM aparecem agrupadas numa linha só.
        </p>

        {anexo.map(({ slot, grupos }) => (
          <div key={slot.dia} style={{ breakInside: 'avoid', marginBottom: 18 }}>
            <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5 }}>
              {DIAS_SEMANA[new Date(slot.dia + 'T00:00:00Z').getUTCDay()]}, {formatarBr(slot.dia)} — {slot.alocacoes.length} RM(s)
            </p>
            <div className="h-px bg-slate-300" style={{ marginBottom: 8 }} />
            {grupos.map((g, i) => (
              <div key={i} style={{ marginBottom: 9, breakInside: 'avoid' }}>
                <p className="text-[10px] font-bold text-slate-800">
                  {g.cam} — {g.rms.length} RM(s) · <span className="font-normal text-slate-500">{g.justificativa}</span>
                </p>
                <p className="text-[9px] text-slate-500" style={{ lineHeight: '13px', marginTop: 1, wordBreak: 'break-word' }}>
                  {g.rms.join(', ')}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ───────────────── ANEXO B ───────────────── */}
      {diff && (
        <div style={{ breakBefore: 'page', paddingTop: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">Anexo B — Alterações desta Versão</h1>
            <p className="text-[10px] text-slate-500" style={{ marginTop: 3 }}>
              {versao} · o que mudou em relação à versão anterior · emitido em {emitidoEm}
            </p>
            <div className="h-0.5 bg-slate-800" style={{ marginTop: 12 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { r: 'RMs incluídas', v: diff.entraram.length },
              { r: 'RMs retiradas', v: diff.sairam.length },
              { r: 'RMs remanejadas', v: diff.remanejadas.length },
              { r: 'Saldo programado', v: `${diff.deltaProgramado > 0 ? '+' : ''}${diff.deltaProgramado}` }
            ].map(c => (
              <div key={c.r} style={{ flex: '1 1 0', minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 5, padding: '7px 9px', textAlign: 'center' }}>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">{c.r}</p>
                <p className="text-base font-black text-slate-900" style={{ lineHeight: '20px', marginTop: 2 }}>{c.v}</p>
              </div>
            ))}
          </div>

          {diff.demandasNovas.length > 0 && (
            <div style={{ breakInside: 'avoid', marginBottom: 16 }}>
              <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5 }}>Demandas que motivaram a alteração</p>
              <div className="h-px bg-slate-300" style={{ marginBottom: 8 }} />
              <Tabela
                colunas={[
                  { key: 'ref', label: 'Origem / Referência', width: '44%', emphasis: true },
                  { key: 'rms', label: 'RMs informadas', width: '18%', align: 'center' },
                  { key: 'prazo', label: 'Prazo', width: '19%', align: 'center' },
                  { key: 'limite', label: 'Separar até', width: '19%', align: 'center' }
                ]}
                linhas={diff.demandasNovas.map(d => ({
                  ref: `${ORIGEM_LABEL[d.origem] || d.origem}${d.referencia ? ` — ${d.referencia}` : ''}`,
                  rms: d.qtd,
                  prazo: formatarBr(d.prazo),
                  limite: formatarBr(limiteDeSeparacao(d.prazo, d.diasExpedicao))
                }))}
              />
            </div>
          )}

          {(diff.bloqueiosNovos.length > 0 || diff.bloqueiosRemovidos.length > 0) && (
            <div style={{ breakInside: 'avoid', marginBottom: 16 }}>
              <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5 }}>Mudanças nos dias de separação</p>
              <div className="h-px bg-slate-300" style={{ marginBottom: 8 }} />
              {diff.bloqueiosNovos.map(b => (
                <p key={`n${b.data}`} className="text-[10px] text-slate-700" style={{ lineHeight: '15px' }}>
                  <strong>{formatarBr(b.data)}</strong> passou a não ter separação — {b.motivo}
                </p>
              ))}
              {diff.bloqueiosRemovidos.map(b => (
                <p key={`r${b.data}`} className="text-[10px] text-slate-700" style={{ lineHeight: '15px' }}>
                  <strong>{formatarBr(b.data)}</strong> voltou a ter separação (antes: {b.motivo})
                </p>
              ))}
            </div>
          )}

          {[
            { titulo: 'RMs incluídas nesta versão', itens: diff.entraram, dia: a => a.dia },
            { titulo: 'RMs retiradas da programação', itens: diff.sairam, dia: a => a.dia }
          ].map(bloco => bloco.itens.length > 0 && (
            <div key={bloco.titulo} style={{ marginBottom: 16 }}>
              <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5 }}>{bloco.titulo} — {bloco.itens.length} RM(s)</p>
              <div className="h-px bg-slate-300" style={{ marginBottom: 8 }} />
              {agruparParaAnexo(bloco.itens).map((g, i) => (
                <div key={i} style={{ marginBottom: 9, breakInside: 'avoid' }}>
                  <p className="text-[10px] font-bold text-slate-800">
                    {g.cam} — {g.rms.length} RM(s) · <span className="font-normal text-slate-500">{g.justificativa}</span>
                  </p>
                  <p className="text-[9px] text-slate-500" style={{ lineHeight: '13px', marginTop: 1, wordBreak: 'break-word' }}>
                    {g.rms.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          ))}

          {diff.remanejadas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p className="text-[11px] font-black text-slate-900 uppercase" style={{ marginBottom: 5 }}>RMs que mudaram de dia — {diff.remanejadas.length} RM(s)</p>
              <div className="h-px bg-slate-300" style={{ marginBottom: 8 }} />
              {Object.entries(
                diff.remanejadas.reduce((acc, a) => {
                  const chave = `${a.diaAnterior}→${a.dia}`;
                  (acc[chave] = acc[chave] || []).push(a.rm);
                  return acc;
                }, {})
              ).map(([chave, rms]) => {
                const [de, para] = chave.split('→');
                return (
                  <div key={chave} style={{ marginBottom: 9, breakInside: 'avoid' }}>
                    <p className="text-[10px] font-bold text-slate-800">
                      De {formatarBr(de)} para {formatarBr(para)} — {rms.length} RM(s)
                    </p>
                    <p className="text-[9px] text-slate-500" style={{ lineHeight: '13px', marginTop: 1, wordBreak: 'break-word' }}>{rms.join(', ')}</p>
                  </div>
                );
              })}
            </div>
          )}

          {diff.totalMudancas === 0 && (
            <p className="text-[10px] text-slate-600">Nenhuma RM mudou de dia, entrou ou saiu em relação à versão anterior.</p>
          )}
        </div>
      )}
    </div>
  );
});

ProgramacaoDocument.displayName = 'ProgramacaoDocument';
export default ProgramacaoDocument;
