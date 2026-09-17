import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Bar, Brush, Area, PieChart, Pie, Cell, BarChart
} from 'recharts';
import {
  TrendingUp, CheckCircle2, Sparkles, Loader2, Target, Clock,
  XCircle, Package, RefreshCw, AlertCircle, LogIn, Scale
} from 'lucide-react';
import InfoButton from './InfoButton';
import PiDetailsModal from './PiDetailsModal';
import HealthBanner from './HealthBanner';
import RiskAlertsPanel from './RiskAlertsPanel';
import GoalsPanel from './GoalsPanel';
import StcGtcCard from './StcGtcCard';
import DeltaBadge from './DeltaBadge';
import SectionLabel from './SectionLabel';
import YoySeasonalityCard from './YoySeasonalityCard';

// Cartão de indicador padronizado: mesmo ícone neutro, mesmo tamanho de
// número e mesmo lugar para a variação — só o conteúdo muda. Isso evita que
// cada indicador "grite" com uma cor própria e deixa o olhar ir direto ao
// que realmente importa: o valor e se ele está melhorando ou piorando.
const TILE_TONE = {
  neutral: { bg: 'bg-white', border: 'border-slate-200', iconBg: 'bg-slate-100', iconText: 'text-slate-500' },
  good: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600' }
};

const KpiTile = (props) => {
  const Icon = props.icon;
  const tone = TILE_TONE[props.tone || 'neutral'];
  return (
    <div className={`${tone.bg} p-5 rounded-2xl shadow-sm border ${tone.border} flex flex-col`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1.5 rounded-lg ${tone.iconBg} ${tone.iconText} shrink-0`}><Icon size={14} /></span>
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wide leading-tight">{props.title}</p>
        </div>
        <InfoButton title={props.infoTitle} description={props.infoDescription} />
      </div>
      <p className="text-3xl font-black text-slate-900 leading-none">
        {props.value} {props.unit && <span className="text-sm text-slate-400 font-bold">{props.unit}</span>}
      </p>
      {props.context && <p className="text-xs text-slate-400 font-medium mt-1.5">{props.context}</p>}
      <div className="mt-3 pt-3 border-t border-slate-100">{props.delta}</div>
    </div>
  );
};

const DashboardTab = ({
  selectionSummary, backlogAnalysis, slaAnalysis, chartData, visibleRangeData, dynamicAnalysis,
  aiAnalysis, isAnalyzing, aiError, analyzeWithAI, visibleRange, setVisibleRange,
  selectedPiSegment, setSelectedPiSegment, data,
  periodComparison, stcGtcAnalysis, health, alerts, onNavigate, goals, updateGoals,
  yoyAnalysis, selectedYoyYears, toggleYoyYear, yoyMetrics, setYoyMetrics
}) => {
  const estimativaZerarFila = selectionSummary?.mediaSeparacoesPeriodo > 0 ? (backlogAnalysis?.totalPending / selectionSummary.mediaSeparacoesPeriodo).toFixed(1) : "indefinido";

  // Calcula corretamente as datas para exibição baseada na nulidade do visibleRange
  const startIdx = visibleRange ? visibleRange.startIndex : 0;
  const endIdx = visibleRange ? visibleRange.endIndex : chartData.length - 1;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <PiDetailsModal
        selectedPiSegment={selectedPiSegment}
        setSelectedPiSegment={setSelectedPiSegment}
        chartData={chartData}
        visibleRange={visibleRange}
        data={data}
      />

      <HealthBanner health={health} alerts={alerts} />

      <SectionLabel title="Visão Geral do Período" description="Indicadores do intervalo selecionado no gráfico mais abaixo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiTile
          icon={LogIn}
          title="Entradas"
          infoTitle="Entradas"
          infoDescription="Total de pedidos que entraram no sistema WMS no período selecionado."
          value={selectionSummary?.entradas.toLocaleString()}
          context={`Média de ${selectionSummary?.mediaEntradasPeriodo} por dia`}
          delta={<DeltaBadge value={periodComparison?.deltas.entradas ?? null} goodDirection="neutral" />}
        />
        <KpiTile
          icon={CheckCircle2}
          title="Saídas"
          infoTitle="Saídas"
          infoDescription="Total de pedidos que foram expedidos (concluídos) pelo WMS no período selecionado."
          value={selectionSummary?.separacoes.toLocaleString()}
          context={`Média de ${selectionSummary?.mediaSeparacoesPeriodo} por dia`}
          delta={<DeltaBadge value={periodComparison?.deltas.separacoes ?? null} goodDirection="up" />}
        />
        <KpiTile
          icon={Target}
          title="Nível de Serviço"
          infoTitle="Nível de Serviço (SLA)"
          infoDescription="Percentual de pedidos expedidos em até 20 dias a partir da data de entrada. É a meta padrão de prazo da operação."
          value={`${slaAnalysis?.taxaNoPrazo}%`}
          context="Pedidos expedidos dentro do prazo"
          delta={<DeltaBadge value={periodComparison?.deltas.slaRate ?? null} format="points" goodDirection="up" />}
        />
        <KpiTile
          icon={Clock}
          title="Tempo Médio de Atendimento"
          infoTitle="Tempo Médio de Atendimento"
          infoDescription="Tempo médio, em dias, entre a entrada e a expedição dos pedidos concluídos no período."
          value={selectionSummary?.avgLeadTimePeriodo}
          unit="dias"
          context="Somente pedidos já expedidos"
          delta={<DeltaBadge value={periodComparison?.deltas.avgLeadTime ?? null} goodDirection="down" />}
        />
        <KpiTile
          icon={Scale}
          tone={selectionSummary?.balanco >= 0 ? "good" : "warning"}
          title="Balanço do Período"
          infoTitle="Balanço Operacional"
          infoDescription="Diferença entre Saídas e Entradas. Positivo indica que a fila está diminuindo; negativo indica que a fila está crescendo."
          value={selectionSummary?.balanco > 0 ? `+${selectionSummary?.balanco}` : selectionSummary?.balanco}
          context={selectionSummary?.balanco >= 0 ? "Fila diminuindo" : "Fila aumentando"}
          delta={null}
        />
        <KpiTile
          icon={RefreshCw}
          title="Previsão para Zerar a Fila"
          infoTitle="Previsão para Zerar a Fila"
          infoDescription="Projeção de quantos dias seriam necessários para expedir todo o backlog atual, mantendo o ritmo médio de saída do período selecionado."
          value={estimativaZerarFila}
          unit={estimativaZerarFila !== "indefinido" ? "dias" : ""}
          context="Baseado no ritmo médio de saída"
          delta={null}
        />
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl"><Sparkles className="text-white" size={22} /></div>
          <div>
            <p className="text-white font-black">Consultoria de IA</p>
            <p className="text-indigo-200 text-xs font-medium">Gera um diagnóstico em texto, em português, a partir dos indicadores acima.</p>
          </div>
        </div>
        <button
          onClick={analyzeWithAI}
          disabled={isAnalyzing}
          className="px-6 py-2.5 rounded-xl font-bold bg-white text-indigo-700 shadow-sm flex items-center gap-2 hover:bg-indigo-50 transition-all text-sm disabled:opacity-60 active:scale-95 shrink-0"
        >
          {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {isAnalyzing ? "Analisando..." : "Analisar Agora"}
        </button>
      </div>

      {aiError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium">
          <AlertCircle size={18} className="shrink-0" /> {aiError}
        </div>
      )}

      {aiAnalysis && (
        <div className="p-1 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl shadow-xl">
          <div className="p-8 bg-white rounded-3xl">
            <div className="flex items-center gap-3 mb-4"><Target className="text-indigo-600" /><h3 className="text-lg font-black">Diagnóstico Operacional</h3></div>
            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
          </div>
        </div>
      )}

      <SectionLabel title="Riscos e Metas" description="O que precisa de atenção agora e como estamos em relação ao combinado" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskAlertsPanel alerts={alerts} onNavigate={onNavigate} />
        <GoalsPanel
          goals={goals}
          updateGoals={updateGoals}
          slaAtual={Number(slaAnalysis?.taxaNoPrazo) || 0}
          avgAge={Number(backlogAnalysis?.avgAge) || 0}
          oldest={backlogAnalysis?.oldestOrder?.daysOpen || 0}
        />
      </div>

      <SectionLabel title="Tendências ao Longo do Tempo" description="Arraste as alças abaixo para mudar o período de todos os gráficos" />

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Período de Análise</h3>
             <InfoButton title="Período de Análise" description="Arraste as alças para filtrar o intervalo de tempo que deseja analisar nos gráficos e indicadores desta aba." />
          </div>
          <div className="text-sm font-semibold text-slate-600">
            {chartData[startIdx]?.date && chartData[endIdx]?.date && (
              <>{new Date(chartData[startIdx].date).toLocaleDateString('pt-BR')} — {new Date(chartData[endIdx].date).toLocaleDateString('pt-BR')}</>
            )}
          </div>
        </div>
        <div className="h-[60px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <XAxis dataKey="date" hide />
              <Brush
                dataKey="date"
                height={35}
                stroke="#cbd5e1"
                fill="#f1f5f9"
                travellerWidth={12}
                startIndex={startIdx}
                endIndex={endIdx}
                onChange={(r) => {
                  if (r && r.startIndex !== undefined && r.endIndex !== undefined) {
                    setVisibleRange({startIndex: r.startIndex, endIndex: r.endIndex});
                  }
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-black text-slate-800">Entradas x Saídas ao Longo do Tempo</h3>
             <InfoButton title="Entradas x Saídas" description="Compara o que entra (Entradas) com o que sai (Saídas) dia a dia. As linhas de média móvel de 7 dias suavizam oscilações diárias para mostrar a tendência real." />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleRangeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis tick={{fontSize: 10}} axisLine={false} />
                <Tooltip labelFormatter={v => `Data: ${new Date(v).toLocaleDateString('pt-BR')}`} />
                <Legend verticalAlign="top" align="right" />
                <Bar dataKey="entradas" name="Volume de Entrada" fill="#e2e8f0" barSize={8} radius={[4,4,0,0]} />
                <Line type="monotone" dataKey="ma7_entradas" name="Média de Entradas (7 dias)" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ma7_separacoes" name="Média de Saídas (7 dias)" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800">Tempo de Atendimento</h3>
              <InfoButton title="Tempo de Atendimento" description="Evolução diária do tempo de atendimento (Lead Time). A área sombreada mostra o desvio, indicando dias de maior instabilidade no processo." />
            </div>
            <div className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] text-indigo-600 font-black">{selectionSummary?.numDias} DIAS NO PERÍODO</div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleRangeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9}} tickFormatter={v => v.split('-')[2]} />
                <YAxis unit="d" tick={{fontSize: 10}} axisLine={false} />
                <Tooltip labelFormatter={v => `Data: ${new Date(v).toLocaleDateString('pt-BR')}`} />
                <Legend verticalAlign="top" align="right" />
                <Area type="monotone" dataKey="channelLower" stackId="volStack" stroke="none" fill="transparent" legendType="none" />
                <Area type="monotone" dataKey="channelHeight" name="Variação (Desvio)" stackId="volStack" stroke="none" fill="#d8b4fe" opacity={0.3} />
                <Line type="monotone" dataKey="leadTimeMa7" name="Média de Atendimento (7 dias)" stroke="#7c3aed" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <YoySeasonalityCard
        yoyAnalysis={yoyAnalysis}
        selectedYoyYears={selectedYoyYears}
        toggleYoyYear={toggleYoyYear}
        yoyMetrics={yoyMetrics}
        setYoyMetrics={setYoyMetrics}
      />

      <SectionLabel title="Qualidade do Processo" description="Tempo total de atendimento e saúde dos pedidos e documentos" />

      <StcGtcCard stcGtcAnalysis={stcGtcAnalysis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <XCircle className="text-red-500" size={20} />
             <h3 className="text-lg font-black text-slate-800">Cancelados x Liberados por Mês</h3>
             <InfoButton title="Cancelados x Liberados" description="Monitora, mês a mês, o volume de pedidos que entraram no fluxo e quantos foram descartados (cancelados)." />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicAnalysis.monthly}>
                <XAxis dataKey="month" tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis tick={{fontSize: 10}} axisLine={false} />
                <Tooltip /><Legend />
                <Bar dataKey="liberados" name="Liberados" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <Package className="text-amber-500" size={20} />
             <h3 className="text-lg font-black text-slate-800">Documentos Cancelados x Fornecidos</h3>
             <InfoButton title="Documentos de Importação (PI)" description="Mede a conversão de Documentos de Importação (PI) no período. Clique nas fatias para listar exatamente quais foram cancelados ou entregues." />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8 h-[300px]">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Entregues', value: dynamicAnalysis.piStats.delivered, type: 'delivered' }, { name: 'Cancelados', value: dynamicAnalysis.piStats.cancelled, type: 'cancelled' }]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={(d) => setSelectedPiSegment(d.type)}>
                    <Cell fill="#10b981" className="cursor-pointer hover:opacity-80" />
                    <Cell fill="#f43f5e" className="cursor-pointer hover:opacity-80" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">Documentos Únicos</p><p className="text-xl font-black text-slate-800">{dynamicAnalysis.piStats.totalUnique}</p></div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100"><p className="text-[10px] font-black text-red-400 uppercase">Taxa de Cancelamento</p><p className="text-xl font-black text-red-600">{dynamicAnalysis.piStats.totalUnique > 0 ? ((dynamicAnalysis.piStats.cancelled / dynamicAnalysis.piStats.totalUnique) * 100).toFixed(1) : 0}%</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
