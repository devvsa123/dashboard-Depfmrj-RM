import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Bar, Brush, Area, PieChart, Pie, Cell, BarChart
} from 'recharts';
import {
  TrendingUp, CheckCircle2, Sparkles, Loader2, Target, Clock,
  XCircle, Package, RefreshCw, AlertCircle
} from 'lucide-react';
import InfoButton from './InfoButton';
import PiDetailsModal from './PiDetailsModal';

const DashboardTab = ({
  selectionSummary, backlogAnalysis, slaAnalysis, chartData, visibleRangeData, dynamicAnalysis,
  aiAnalysis, isAnalyzing, aiError, analyzeWithAI, visibleRange, setVisibleRange,
  selectedPiSegment, setSelectedPiSegment, data
}) => {
  const estimativaZerarFila = selectionSummary?.mediaSeparacoesPeriodo > 0 ? (backlogAnalysis?.totalPending / selectionSummary.mediaSeparacoesPeriodo).toFixed(1) : "N/A";

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-1">
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Entradas (Corte)</p>
             <InfoButton title="Entradas (Corte)" description="Total de pedidos que entraram no sistema WMS no período selecionado." />
          </div>
          <p className="text-2xl font-black text-slate-800">{selectionSummary?.entradas.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-indigo-600 font-bold flex items-center gap-1"><TrendingUp size={12} /> {selectionSummary?.mediaEntradasPeriodo}/dia</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-1">
             <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest italic">Saídas (Corte)</p>
             <InfoButton title="Saídas (Corte)" description="Total de pedidos que foram expedidos/concluídos pelo WMS no período filtrado." />
          </div>
          <p className="text-2xl font-black text-slate-800">{selectionSummary?.separacoes.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> {selectionSummary?.mediaSeparacoesPeriodo}/dia</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-1">
             <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest italic">Nivel de serviço (Até 20 dias)</p>
             <InfoButton title="SLA (Nível de Serviço)" description="Percentual de pedidos expedidos em até 20 dias a partir da data de entrada. Meta padrão da operação." />
          </div>
          <p className="text-2xl font-black text-slate-800">{slaAnalysis?.taxaNoPrazo}%</p>
          <div className="mt-1 text-[10px] text-blue-600 font-bold flex items-center gap-1"><Target size={12} /> No prazo definido</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-1">
             <p className="text-purple-500 text-[10px] font-black uppercase tracking-widest italic">Lead Time Médio</p>
             <InfoButton title="Lead Time Médio" description="Tempo médio (em dias) que os pedidos levaram desde a entrada até a expedição final no período." />
          </div>
          <p className="text-2xl font-black text-slate-800">{selectionSummary?.avgLeadTimePeriodo} <span className="text-xs text-slate-400 font-bold">dias</span></p>
          <div className="mt-1 text-[10px] text-purple-600 font-bold flex items-center gap-1"><Clock size={12} /> (Expedidos)</div>
        </div>
        <div className={`p-6 rounded-3xl shadow-sm border-2 transition-all ${selectionSummary?.balanco >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
           <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Balanço</p>
              <InfoButton title="Balanço Operacional" description="Diferença entre Saídas e Entradas. Se positivo, estamos reduzindo o backlog; se negativo, a fila está crescendo." />
           </div>
           <p className={`text-2xl font-black ${selectionSummary?.balanco >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
             {selectionSummary?.balanco > 0 ? `+${selectionSummary?.balanco}` : selectionSummary?.balanco}
           </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-1">
             <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest italic">Zerar Backlog</p>
             <InfoButton title="Estimativa de Zeragem" description="Projeção de quantos dias seriam necessários para expedir todo o backlog atual baseado no ritmo médio de saída." />
          </div>
          <p className="text-2xl font-black text-slate-800">{estimativaZerarFila} <span className="text-xs text-slate-400 font-bold">dias</span></p>
          <div className="mt-1 text-[10px] text-orange-600 font-bold flex items-center gap-1"><RefreshCw size={12} /> Previsão de fila</div>
        </div>
        <button onClick={analyzeWithAI} disabled={isAnalyzing} className="group p-6 rounded-3xl shadow-lg transition-all flex flex-col justify-center items-start bg-indigo-600 text-white hover:bg-indigo-700 overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-indigo-200 italic">Consultoria AI</p>
          <div className="flex items-center gap-2 w-full justify-between relative z-10">
            <span className="text-lg font-bold">Analisar ✨</span>
            {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </div>
        </button>
      </div>

      {aiError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium mt-4">
          <AlertCircle size={18} className="shrink-0" /> {aiError}
        </div>
      )}

      {aiAnalysis && (
        <div className="p-1 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-[34px] shadow-xl mt-4">
          <div className="p-8 bg-white rounded-[32px]">
            <div className="flex items-center gap-3 mb-4"><Target className="text-indigo-600" /><h3 className="text-lg font-black">Diagnóstico Operacional</h3></div>
            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-200 mb-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Seleção de Período de Análise</h3>
             <InfoButton title="Seleção de Período" description="Arraste as alças para filtrar o intervalo de tempo que deseja analisar nos gráficos e indicadores acima." />
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
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-black text-slate-800">Taxa de Liberação X Taxa de Expedição</h3>
             <InfoButton title="Tendência de Fluxo" description="Comparação entre o que entra (Liberação) e o que sai (Expedição). As linhas MM7 suavizam as oscilações para mostrar a tendência real." />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleRangeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis tick={{fontSize: 10}} axisLine={false} />
                <Tooltip labelFormatter={v => `Data: ${new Date(v).toLocaleDateString('pt-BR')}`} />
                <Legend verticalAlign="top" align="right" />
                <Bar dataKey="entradas" name="Vol. Entrada" fill="#e2e8f0" barSize={8} radius={[4,4,0,0]} />
                <Line type="monotone" dataKey="ma7_entradas" name="MM7 Liberação" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ma7_separacoes" name="MM7 Saída" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800">Tempo de Atendimento</h3>
              <InfoButton title="Aging Lead Time" description="Evolução diária do tempo de atendimento. A área sombreada mostra o 'Desvio', indicando dias de muita instabilidade no processo." />
            </div>
            <div className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] text-indigo-600 font-black">FILTRO: {selectionSummary?.numDias} DIAS</div>
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
                <Area type="monotone" dataKey="channelHeight" name="Volatilidade (Desvio)" stackId="volStack" stroke="none" fill="#d8b4fe" opacity={0.3} />
                <Line type="monotone" dataKey="leadTimeMa7" name="MM7 Atendimento" stroke="#7c3aed" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <XCircle className="text-red-500" size={20} />
             <h3 className="text-lg font-black text-slate-800">Cancelados vs Liberados (Dinâmico)</h3>
             <InfoButton title="Saúde dos Pedidos" description="Monitora mensalmente o volume de pedidos que entraram no fluxo e quantos foram descartados/cancelados." />
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
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <Package className="text-amber-500" size={20} />
             <h3 className="text-lg font-black text-slate-800">PI cancelados no período X PI fornecidos</h3>
             <InfoButton title="Análise de PI" description="Mede a conversão de Documentos de Importação (PI). Clique nas fatias para listar exatamente quais foram cancelados ou entregues." />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8 h-[300px]">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'PIs Entregues', value: dynamicAnalysis.piStats.delivered, type: 'delivered' }, { name: 'PIs Cancelados', value: dynamicAnalysis.piStats.cancelled, type: 'cancelled' }]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={(d) => setSelectedPiSegment(d.type)}>
                    <Cell fill="#10b981" className="cursor-pointer hover:opacity-80" />
                    <Cell fill="#f43f5e" className="cursor-pointer hover:opacity-80" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">PIs Únicos</p><p className="text-xl font-black text-slate-800">{dynamicAnalysis.piStats.totalUnique}</p></div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100"><p className="text-[10px] font-black text-red-400 uppercase">Taxa de cancelamento</p><p className="text-xl font-black text-red-600">{dynamicAnalysis.piStats.totalUnique > 0 ? ((dynamicAnalysis.piStats.cancelled / dynamicAnalysis.piStats.totalUnique) * 100).toFixed(1) : 0}%</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
