import { Fragment } from 'react';
import {
  Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart,
  Bar, Area, Cell, BarChart, LineChart
} from 'recharts';

// -----------------------------------------------------------------------
// Documento estático do relatório mensal: NÃO reaproveita os cartões do
// dashboard. É uma renderização paralela, pensada para ser lida como um
// documento arquivado (títulos numerados, tabelas, texto corrido) — sem
// botões, sem tooltip de hover, sem inputs nativos, sem cards coloridos.
// Só usa a MESMA leitura de dados já calculada pelos hooks do dashboard.
// Fica sempre fora da tela (ver estilo no componente pai) e só é
// capturada em imagem no momento de gerar o PDF.
//
// Cada grupo de seções fica dentro de um <PdfPage>, que carrega a classe
// "pdf-section" — o utilitário de exportação (pdfReport.js) configura o
// html2pdf para sempre começar uma página nova antes de cada elemento com
// essa classe. É uma quebra de página EXPLÍCITA (não uma tentativa
// heurística de "evitar cortar"), por isso o resultado é sempre o mesmo
// formato, na mesma ordem — nada de conteúdo cortado ao acaso no meio da
// página.
// -----------------------------------------------------------------------

const SEVERITY_LABEL = { critical: 'Crítico', warning: 'Atenção' };
const SEVERITY_COLOR = { critical: '#dc2626', warning: '#d97706' };
const TYPE_COLOR = { STC: '#4f46e5', GTC: '#d97706', RMT: '#0369a1', RMC: '#7c3aed' };

const fmtNum = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR'));
const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const fmtDelta = (v, unit = '%') => {
  if (v === null || v === undefined) return 'sem base de comparação';
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return 'estável';
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`;
};

const PdfPage = ({ children }) => (
  <div className="pdf-section" style={{ breakBefore: 'page' }}>{children}</div>
);

const SectionHeading = ({ number, title, description }) => (
  <div style={{ marginBottom: 14, breakAfter: 'avoid' }}>
    <div className="flex items-center gap-2.5">
      <span style={{ background: '#4f46e5', color: '#ffffff', width: 22, height: 22, borderRadius: 5, textAlign: 'center', lineHeight: '22px' }} className="text-xs font-black">{number}</span>
      <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">{title}</h2>
    </div>
    {description && <p className="text-xs text-slate-500 mt-1" style={{ lineHeight: '16px' }}>{description}</p>}
    <div className="h-px bg-slate-300 mt-2.5" />
  </div>
);

// Renderizado com flexbox em vez de <table> de propósito: o html2canvas
// (usado para gerar o PDF) tem suporte parcial e pouco confiável ao layout
// de tabelas HTML (larguras de coluna fixas/percentuais não são sempre
// respeitadas), mas lida bem com flexbox — o que evita colunas cortadas
// na borda da página.
// minWidth: 0 é essencial aqui — sem isso, um item flex nunca encolhe
// abaixo da largura intrínseca do seu conteúdo (regra padrão do CSS,
// min-width:auto), então um cabeçalho longo como "TEMPO MÉDIO" ou "% DO
// VOLUME" empurraria a coluna para além do espaço reservado a ela.
const colStyle = (col) => ({
  flex: col.width ? `0 0 ${col.width}` : '1 1 0',
  minWidth: 0,
  textAlign: col.align || 'left',
  wordBreak: 'break-word'
});

const DataTable = ({ columns, rows, style }) => (
  <div style={{ breakInside: 'avoid', paddingBottom: 6, ...style }}>
    <div style={{ display: 'flex', borderBottom: '1.5px solid #334155', padding: '5px 8px' }}>
      {columns.map(col => (
        <div key={col.key} style={colStyle(col)} className="text-slate-700 font-bold uppercase text-[9px] tracking-wide">
          {col.label}
        </div>
      ))}
    </div>
    {rows.map((row, i) => (
      <div key={i} style={{ display: 'flex', backgroundColor: i % 2 === 1 ? '#f8fafc' : 'transparent', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #e2e8f0', padding: '5px 8px' }}>
        {columns.map(col => (
          <div key={col.key} style={colStyle(col)} className={`text-[11px] ${col.emphasis ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
            {row[col.key]}
          </div>
        ))}
      </div>
    ))}
  </div>
);

const StaticLegend = ({ items }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
    {items.map(item => (
      <div key={item.label} className="flex items-center gap-1.5">
        <span style={{ width: 9, height: 9, borderRadius: item.dashed ? 0 : 9, background: item.dashed ? 'none' : item.color, borderBottom: item.dashed ? `2px dashed ${item.color}` : 'none' }} />
        <span className="text-[9px] font-semibold text-slate-600">{item.label}</span>
      </div>
    ))}
  </div>
);

const ChartFrame = ({ caption, height = 210, children }) => (
  <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
    <div style={{ height, width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px 4px' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
    {caption && <p className="text-[9px] text-slate-400 text-center mt-1">{caption}</p>}
  </div>
);

const AlertRow = ({ alert }) => (
  <div style={{ borderLeft: `3px solid ${SEVERITY_COLOR[alert.severity]}`, breakInside: 'avoid', padding: '4px 0 4px 10px', marginBottom: 6 }}>
    <p className="text-[11px] font-bold text-slate-800">
      <span style={{ color: SEVERITY_COLOR[alert.severity] }}>[{SEVERITY_LABEL[alert.severity]}]</span> {alert.title}
    </p>
    <p className="text-[10px] text-slate-500">{alert.description}</p>
  </div>
);

const GoalBar = ({ label, value, target, unit, higherIsBetter }) => {
  if (value === null || value === undefined) {
    return (
      <div style={{ marginBottom: 12, breakInside: 'avoid' }}>
        <div className="flex justify-between text-[10px] font-bold text-slate-400" style={{ lineHeight: '16px' }}><span>{label}</span><span>sem dados no período</span></div>
      </div>
    );
  }
  const ratio = higherIsBetter ? (value / target) * 100 : (target / Math.max(value, 0.0001)) * 100;
  const pct = Math.max(0, Math.min(ratio, 100));
  const color = ratio >= 100 ? '#059669' : ratio >= 75 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginBottom: 12, breakInside: 'avoid' }}>
      <div className="flex justify-between text-[10px] font-bold text-slate-700" style={{ lineHeight: '16px' }}>
        <span>{label}</span>
        <span>{value}{unit} <span className="text-slate-400 font-medium">/ meta {target}{unit}</span></span>
      </div>
      <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const CoverStat = ({ label, value }) => (
  <div style={{ flex: '1 1 0' }}>
    <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</p>
  </div>
);

const ReportDocument = ({
  ref, monthLabel, periodLabel, comparisonLabel,
  selectionSummary, slaAnalysis, backlogAnalysis, periodComparison, comparisonSeries, visibleRangeData,
  alerts, health, goals, stcGtcAnalysis, rmTypeComparison, camAnalysis, interfaceAnalysis, dynamicAnalysis, yoyAnalysis
}) => {
  const chartSeries = comparisonSeries || visibleRangeData || [];
  const hasComparison = Boolean(periodComparison);
  const stcGroup = stcGtcAnalysis?.groups?.find(g => g.type === 'STC');
  const gtcGroup = stcGtcAnalysis?.groups?.find(g => g.type === 'GTC');
  const stcDoc = stcGtcAnalysis?.documents?.find(d => d.type === 'STC');
  const healthLabel = health === 'critical' ? 'Crítica' : health === 'warning' ? 'Requer Atenção' : 'Saudável';
  const topCams = camAnalysis?.rows?.length
    ? [...camAnalysis.rows].sort((a, b) => b.entradas - a.entradas).slice(0, 12)
    : [];

  return (
    // width: '100%' (não um px fixo) é proposital — o html2pdf.js clona
    // este elemento dentro de um container próprio, já dimensionado para
    // caber exatamente na largura útil da página impressa (A4 menos as
    // margens). Um valor fixo mais largo que esse container fazia o
    // conteúdo (principalmente as últimas colunas das tabelas) ficar para
    // fora e ser cortado pelo html2canvas na hora da captura.
    <div ref={ref} style={{ width: '100%', background: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1e293b' }}>
      {/* Capa — sem a classe pdf-section: por ser o primeiro elemento do
          documento, a regra de quebra forçada "before" (ver pdfReport.js)
          inseriria uma página em branco antes dela. */}
      <div style={{ padding: '80px 32px 40px', minHeight: 620, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="flex items-center gap-2 mb-8">
            <span style={{ width: 14, height: 14, borderRadius: 4, background: '#4f46e5' }} />
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Supply Monitor Integrado</p>
          </div>
          <h1 className="text-4xl font-black text-slate-900 leading-tight">Relatório Mensal<br />de Indicadores</h1>
          <h2 className="text-xl font-bold text-indigo-600 mt-3">{monthLabel}</h2>

          <div style={{ marginTop: 40, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                <tr><td className="text-slate-400 font-bold pr-4 align-top pb-2">Período do relatório</td><td className="text-slate-700 font-semibold pb-2">{periodLabel}</td></tr>
                {comparisonLabel && <tr><td className="text-slate-400 font-bold pr-4 align-top pb-2">Comparado com</td><td className="text-slate-700 font-semibold pb-2">{comparisonLabel}</td></tr>}
                <tr><td className="text-slate-400 font-bold pr-4 align-top pb-2">Situação geral</td><td className="text-slate-700 font-semibold pb-2">{healthLabel}</td></tr>
                <tr><td className="text-slate-400 font-bold pr-4 align-top">Gerado em</td><td className="text-slate-700 font-semibold">{new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ borderTop: '3px solid #4f46e5', paddingTop: 20 }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumo do Período</p>
          <div className="flex" style={{ gap: 24 }}>
            <CoverStat label="Entradas" value={fmtNum(selectionSummary?.entradas)} />
            <CoverStat label="Saídas" value={fmtNum(selectionSummary?.separacoes)} />
            <CoverStat label="Nível de Serviço" value={`${slaAnalysis?.taxaNoPrazo}%`} />
            <CoverStat label="Tempo Médio" value={`${selectionSummary?.avgLeadTimePeriodo}d`} />
          </div>
        </div>
      </div>

      {/* 1-2. Resumo Executivo + Riscos e Alertas */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading number={1} title="Resumo Executivo" description="Indicadores agregados do período do relatório." />
          <DataTable
            columns={[
              { key: 'indicador', label: 'Indicador', width: '46%' },
              { key: 'valor', label: 'Valor', align: 'right', emphasis: true, width: '24%' },
              { key: 'variacao', label: hasComparison ? 'Variação vs. período anterior' : 'Variação', align: 'right', width: '30%' }
            ]}
            rows={[
              { indicador: 'Entradas', valor: fmtNum(selectionSummary?.entradas), variacao: fmtDelta(periodComparison?.deltas.entradas) },
              { indicador: 'Saídas', valor: fmtNum(selectionSummary?.separacoes), variacao: fmtDelta(periodComparison?.deltas.separacoes) },
              { indicador: 'Nível de Serviço (SLA)', valor: `${slaAnalysis?.taxaNoPrazo}%`, variacao: fmtDelta(periodComparison?.deltas.slaRate, ' p.p.') },
              { indicador: 'Tempo Médio de Atendimento', valor: `${selectionSummary?.avgLeadTimePeriodo} dias`, variacao: fmtDelta(periodComparison?.deltas.avgLeadTime) },
              { indicador: 'Balanço do Período (Saídas − Entradas)', valor: selectionSummary?.balanco > 0 ? `+${selectionSummary?.balanco}` : fmtNum(selectionSummary?.balanco), variacao: '—' },
              { indicador: 'Idade Média da Fila (situação atual)', valor: `${backlogAnalysis?.avgAge ?? '—'} dias`, variacao: '—' },
              { indicador: 'Pedido Mais Antigo em Aberto (situação atual)', valor: `${backlogAnalysis?.oldestOrder?.daysOpen ?? '—'} dias`, variacao: '—' }
            ]}
            style={{ marginBottom: 28 }}
          />

          <SectionHeading number={2} title="Riscos e Alertas" description="Pontos que ficaram fora da meta combinada no período." />
          {alerts && alerts.length > 0 ? (
            alerts.map(a => <AlertRow key={a.id} alert={a} />)
          ) : (
            <p className="text-[11px] text-emerald-700 font-semibold">Nenhum risco identificado com as metas atuais.</p>
          )}
        </div>
      </PdfPage>

      {/* 3-4. Metas e Progresso + Comparativo RMT x RMC */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading number={3} title="Metas e Progresso" description="Indicadores atuais comparados às metas definidas pela equipe." />
          <div style={{ marginBottom: 28 }}>
            <GoalBar label="Idade Média da Fila" value={Number(backlogAnalysis?.avgAge) || 0} target={goals.maxBacklogAge} unit="d" higherIsBetter={false} />
            <GoalBar label="Pedido Mais Antigo" value={backlogAnalysis?.oldestOrder?.daysOpen || 0} target={goals.maxOldestOrder} unit="d" higherIsBetter={false} />
            <GoalBar label={`SLA — STC (até ${stcGroup?.metaSlaDias ?? '—'}d)`} value={stcGroup?.onTimeRate ?? null} target={goals.stcSlaTarget} unit="%" higherIsBetter />
            <GoalBar label={`SLA — GTC (até ${gtcGroup?.metaSlaDias ?? '—'}d)`} value={gtcGroup?.onTimeRate ?? null} target={goals.gtcSlaTarget} unit="%" higherIsBetter />
          </div>

          <SectionHeading number={4} title="Comparativo por Tipo de RM (RMT x RMC)" />
          {rmTypeComparison?.hasData ? (
            <>
              <DataTable
                columns={[
                  { key: 'tipo', label: 'Tipo', emphasis: true, width: '15%' },
                  { key: 'entradas', label: 'Entradas', align: 'right', width: '20%' },
                  { key: 'share', label: '% do Volume', align: 'right', width: '22%' },
                  { key: 'sla', label: 'SLA no Prazo', align: 'right', width: '21%' },
                  { key: 'lead', label: 'Tempo Médio', align: 'right', width: '22%' }
                ]}
                rows={rmTypeComparison.groups.map(g => ({
                  tipo: g.type, entradas: fmtNum(g.entradas), share: fmtPct(g.share),
                  sla: fmtPct(g.slaRate), lead: g.avgLeadTime != null ? `${g.avgLeadTime} dias` : '—'
                }))}
                style={{ marginBottom: 10 }}
              />
              <ChartFrame caption="Nível de serviço (SLA) por tipo de RM" height={110}>
                <BarChart data={rmTypeComparison.groups} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} unit="%" />
                  <YAxis dataKey="type" type="category" width={40} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
                  <Bar dataKey="slaRate" isAnimationActive={false} radius={[0, 4, 4, 0]} barSize={18}>
                    {rmTypeComparison.groups.map(g => <Cell key={g.type} fill={TYPE_COLOR[g.type]} />)}
                  </Bar>
                </BarChart>
              </ChartFrame>
            </>
          ) : <p className="text-[11px] text-slate-400">Sem pedidos de RMT/RMC no período.</p>}
        </div>
      </PdfPage>

      {/* 5. Tendências ao Longo do Tempo */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading number={5} title="Tendências ao Longo do Tempo" description={`Série diária do período do relatório${hasComparison ? ', com o período de referência sobreposto (linha tracejada)' : ''}.`} />
          <ChartFrame caption="Entradas x Saídas ao longo do tempo (média móvel de 7 dias)" height={210}>
            <ComposedChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} />
              <Bar dataKey="entradas" fill="#e2e8f0" barSize={5} isAnimationActive={false} />
              <Line type="monotone" dataKey="ma7_entradas" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ma7_separacoes" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
              {comparisonSeries && <Line type="monotone" dataKey="cmp_ma7_entradas" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
              {comparisonSeries && <Line type="monotone" dataKey="cmp_ma7_separacoes" stroke="#6ee7b7" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
            </ComposedChart>
          </ChartFrame>
          <StaticLegend items={[
            { color: '#3b82f6', label: 'Média de Entradas (7 dias)' },
            { color: '#10b981', label: 'Média de Saídas (7 dias)' },
            ...(comparisonSeries ? [{ color: '#93c5fd', label: 'Entradas (referência)', dashed: true }, { color: '#6ee7b7', label: 'Saídas (referência)', dashed: true }] : [])
          ]} />

          <div style={{ height: 20 }} />

          <ChartFrame caption="Tempo de atendimento ao longo do tempo (média móvel de 7 dias)" height={210}>
            <ComposedChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={v => v.split('-')[2]} />
              <YAxis unit="d" tick={{ fontSize: 9 }} axisLine={false} />
              <Area type="monotone" dataKey="channelLower" stackId="v" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area type="monotone" dataKey="channelHeight" stackId="v" stroke="none" fill="#d8b4fe" opacity={0.3} isAnimationActive={false} />
              <Line type="monotone" dataKey="leadTimeMa7" stroke="#7c3aed" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {comparisonSeries && <Line type="monotone" dataKey="cmp_leadTimeMa7" stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
            </ComposedChart>
          </ChartFrame>
          <StaticLegend items={[
            { color: '#7c3aed', label: 'Média de Atendimento (7 dias)' },
            { color: '#d8b4fe', label: 'Variação (desvio)' },
            ...(comparisonSeries ? [{ color: '#c4b5fd', label: 'Atendimento (referência)', dashed: true }] : [])
          ]} />
        </div>
      </PdfPage>

      {/* 6. Sazonalidade */}
      {yoyAnalysis?.chartData?.length > 0 && (
        <PdfPage>
          <div style={{ padding: '36px 32px 0' }}>
            <SectionHeading number={6} title="Sazonalidade — Comparativo Entre Anos" description="Entradas e saídas mês a mês, sobrepondo os últimos anos disponíveis." />
            <ChartFrame caption="Entradas (tracejado) e Saídas (sólido) por ano" height={240}>
              <LineChart data={yoyAnalysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthName" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} />
                {yoyAnalysis.availableYears.slice(0, 3).map((year, idx) => {
                  const color = ['#6366f1', '#f59e0b', '#10b981'][idx % 3];
                  return (
                    <Fragment key={year}>
                      <Line type="monotone" dataKey={`${year}_entradas`} stroke={color} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey={`${year}_saidas`} stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </Fragment>
                  );
                })}
              </LineChart>
            </ChartFrame>
            <StaticLegend items={yoyAnalysis.availableYears.slice(0, 3).map((year, idx) => ({
              color: ['#6366f1', '#f59e0b', '#10b981'][idx % 3], label: `${year}`
            }))} />
          </div>
        </PdfPage>
      )}

      {/* 7. STC/GTC */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading number={7} title="Qualidade do Processo — STC/GTC" description="Tempo total do processo e situação dos documentos (não dos pedidos)." />
          {(stcGtcAnalysis?.hasData || stcDoc?.totalDocuments > 0) ? (
            <>
              <DataTable
                columns={[
                  { key: 'tipo', label: 'Tipo', emphasis: true, width: '14%' },
                  { key: 'avg', label: 'Média', align: 'right', width: '17%' },
                  { key: 'mediana', label: 'Mediana', align: 'right', width: '17%' },
                  { key: 'docs', label: 'Documentos', align: 'right', width: '18%' },
                  { key: 'pedidos', label: 'Pedidos', align: 'right', width: '16%' },
                  { key: 'sla', label: '% no Prazo', align: 'right', width: '18%' }
                ]}
                rows={(stcGtcAnalysis.groups || []).map(g => ({
                  tipo: g.type, avg: g.pedidoCount > 0 ? `${g.avgDays}d` : '—', mediana: g.pedidoCount > 0 ? `${g.medianDays}d` : '—',
                  docs: fmtNum(g.documentCount), pedidos: fmtNum(g.pedidoCount), sla: fmtPct(g.onTimeRate)
                }))}
                style={{ marginBottom: 10 }}
              />
              <DataTable
                columns={[
                  { key: 'tipo', label: 'Tipo', emphasis: true, width: '14%' },
                  { key: 'total', label: 'Total Docs.', align: 'right', width: '17%' },
                  { key: 'concluidos', label: 'Concluídos', align: 'right', width: '17%' },
                  { key: 'parciais', label: 'Parciais', align: 'right', width: '17%' },
                  { key: 'pendentes', label: 'Pendentes', align: 'right', width: '17%' },
                  { key: 'taxa', label: '% Concluído', align: 'right', width: '18%' }
                ]}
                rows={(stcGtcAnalysis.documents || []).map(d => ({
                  tipo: d.type, total: fmtNum(d.totalDocuments), concluidos: fmtNum(d.completedDocuments),
                  parciais: fmtNum(d.partialDocuments), pendentes: fmtNum(d.pendingDocuments), taxa: fmtPct(d.completionRate)
                }))}
              />
            </>
          ) : <p className="text-[11px] text-slate-400">Sem pedidos com STC/GTC identificado.</p>}
        </div>
      </PdfPage>

      {/* 8-9. OMS + Cancelados/PI */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading
            number={8}
            title="Retirada de Material e Arrecadação OMS"
            description="Arrecadados contam apenas dentro do período configurado na aba Interface."
          />
          <DataTable
            columns={[
              { key: 'situacao', label: 'Situação', width: '55%' },
              { key: 'pedidos', label: 'Pedidos', align: 'right', width: '15%' },
              { key: 'stc', label: 'STC', align: 'right', width: '15%' },
              { key: 'gtc', label: 'GTC', align: 'right', width: '15%' }
            ]}
            rows={[
              { situacao: 'Aguardando Retirada de Material', pedidos: fmtNum(interfaceAnalysis?.aguardandoRetiradaSummary?.pedidoCount), stc: fmtNum(interfaceAnalysis?.aguardandoRetiradaSummary?.stcCount), gtc: fmtNum(interfaceAnalysis?.aguardandoRetiradaSummary?.gtcCount) },
              { situacao: 'Aguardando Arrecadação OMS', pedidos: fmtNum(interfaceAnalysis?.aguardandoArrecadacaoSummary?.pedidoCount), stc: fmtNum(interfaceAnalysis?.aguardandoArrecadacaoSummary?.stcCount), gtc: fmtNum(interfaceAnalysis?.aguardandoArrecadacaoSummary?.gtcCount) },
              { situacao: 'Arrecadado pela OMS (finalizados)', pedidos: fmtNum(interfaceAnalysis?.arrecadadoOmsSummary?.pedidoCount), stc: fmtNum(interfaceAnalysis?.arrecadadoOmsSummary?.stcCount), gtc: fmtNum(interfaceAnalysis?.arrecadadoOmsSummary?.gtcCount) }
            ]}
            style={{ marginBottom: 10 }}
          />
          {interfaceAnalysis?.arrecadadoOmsSummary?.monthly?.length > 0 && (
            <>
              <ChartFrame caption="STC e GTC arrecadados pela OMS, por mês" height={150}>
                <BarChart data={interfaceAnalysis.arrecadadoOmsSummary.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} allowDecimals={false} />
                  <Bar dataKey="stc" fill={TYPE_COLOR.STC} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="gtc" fill={TYPE_COLOR.GTC} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ChartFrame>
              <StaticLegend items={[{ color: TYPE_COLOR.STC, label: 'STC' }, { color: TYPE_COLOR.GTC, label: 'GTC' }]} />
            </>
          )}

          <div style={{ marginTop: 28 }}>
            <SectionHeading number={9} title="Cancelados, Liberados e Documentos de Importação" />
            {dynamicAnalysis?.monthly?.length > 0 && (
              <>
                <ChartFrame caption="Liberados x Cancelados, por mês" height={150}>
                  <BarChart data={dynamicAnalysis.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} />
                    <Bar dataKey="liberados" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="cancelados" fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartFrame>
                <StaticLegend items={[{ color: '#6366f1', label: 'Liberados' }, { color: '#ef4444', label: 'Cancelados' }]} />
              </>
            )}
            <div style={{ height: 10 }} />
            <DataTable
              columns={[{ key: 'indicador', label: 'Documentos de Importação (PI)', width: '70%' }, { key: 'valor', label: 'Valor', align: 'right', emphasis: true, width: '30%' }]}
              rows={[
                { indicador: 'Documentos Únicos no Período', valor: fmtNum(dynamicAnalysis?.piStats?.totalUnique) },
                { indicador: 'Entregues', valor: fmtNum(dynamicAnalysis?.piStats?.delivered) },
                { indicador: 'Cancelados', valor: fmtNum(dynamicAnalysis?.piStats?.cancelled) },
                { indicador: 'Taxa de Cancelamento', valor: dynamicAnalysis?.piStats?.totalUnique > 0 ? `${((dynamicAnalysis.piStats.cancelled / dynamicAnalysis.piStats.totalUnique) * 100).toFixed(1)}%` : '0%' }
              ]}
            />
          </div>
        </div>
      </PdfPage>

      {/* 10. Análise por CAM */}
      <PdfPage>
        <div style={{ padding: '36px 32px 0' }}>
          <SectionHeading
            number={10}
            title="Análise por CAM"
            description={`Os ${topCams.length} CAMs de maior volume no período. Entradas, expedidos, SLA, STC, GTC e cancelados seguem o período do relatório; fila é a situação atual.`}
          />
          {topCams.length > 0 ? (
            <DataTable
              columns={[
                { key: 'cam', label: 'CAM', width: '26%' },
                { key: 'entradas', label: 'Entradas', align: 'right', width: '13%' },
                { key: 'expedidos', label: 'Expedidos', align: 'right', width: '13%' },
                { key: 'avgLeadTime', label: 'Tempo Médio', align: 'right', width: '14%' },
                { key: 'slaRate', label: 'SLA', align: 'right', width: '11%' },
                { key: 'pendentes', label: 'Fila Atual', align: 'right', width: '11%' },
                { key: 'stcCount', label: 'STC', align: 'right', width: '6%' },
                { key: 'gtcCount', label: 'GTC', align: 'right', width: '6%' }
              ]}
              rows={topCams.map(c => ({
                cam: c.cam, entradas: fmtNum(c.entradas), expedidos: fmtNum(c.expedidos),
                avgLeadTime: c.avgLeadTime != null ? `${c.avgLeadTime}d` : '—', slaRate: fmtPct(c.slaRate),
                pendentes: fmtNum(c.pendentes), stcCount: fmtNum(c.stcCount), gtcCount: fmtNum(c.gtcCount)
              }))}
            />
          ) : <p className="text-[11px] text-slate-400">Sem dados de CAM disponíveis.</p>}

          <div style={{ marginTop: 28, paddingTop: 10, borderTop: '1px solid #cbd5e1' }}>
            <p className="text-[9px] text-slate-400">Documento gerado automaticamente pelo Supply Monitor Integrado a partir dos dados sincronizados de WMS e SINGRA.</p>
          </div>
        </div>
      </PdfPage>
    </div>
  );
};

export default ReportDocument;
