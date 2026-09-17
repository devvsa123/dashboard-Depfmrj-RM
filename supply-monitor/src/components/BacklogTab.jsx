import { Fragment } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Bar, BarChart, PieChart, Pie, Cell
} from 'recharts';
import {
  CheckCircle2, ListFilter, X, Network, Hourglass, Clock, AlertTriangle,
  Calendar, Activity, Download
} from 'lucide-react';
import { getStatusColor } from '../constants';
import InfoButton from './InfoButton';
import BucketDetailsModal from './BucketDetailsModal';

const BacklogTab = ({
  backlogAnalysis, backlogStartDate, setBacklogStartDate, backlogEndDate, setBacklogEndDate,
  backlogTypeFilter, setBacklogTypeFilter, selectedBucket, setSelectedBucket,
  bucketSearchTerm, setBucketSearchTerm, handleDownloadExcel,
  yoyAnalysis, selectedYoyYears, toggleYoyYear, yoyMetrics, setYoyMetrics
}) => {
  // 1. Extraímos o painel de controles para ele NUNCA sumir da tela
  const controlsPanel = (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-6 mb-6">
      <div className="flex-1">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-1">
          <ListFilter size={16} className="text-indigo-500" /> Controles da Fila (Backlog)
        </h3>
        <p className="text-xs text-slate-500 font-medium">Analise o envelhecimento e o status dos pedidos pendentes na operação.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {['TODOS', 'RMT', 'RMC'].map(type => (
            <button
              key={type}
              onClick={() => setBacklogTypeFilter(type)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${backlogTypeFilter === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative">
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Início</label>
          <input type="date" value={backlogStartDate} onChange={e => setBacklogStartDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div className="relative">
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Fim</label>
          <input type="date" value={backlogEndDate} onChange={e => setBacklogEndDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
        </div>

        {(backlogStartDate || backlogEndDate || backlogTypeFilter !== "TODOS") && (
          <button
            onClick={() => { setBacklogStartDate(""); setBacklogEndDate(""); setBacklogTypeFilter("TODOS"); }}
            className="mt-5 p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 rounded-full"
            title="Limpar Filtros"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // 2. Se a fila estiver vazia, mostramos os controles + mensagem amigável
  if (!backlogAnalysis || backlogAnalysis.totalPending === 0) {
    return (
      <div className="animate-in fade-in zoom-in duration-300">
        {controlsPanel}
        <div className="mt-20 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={48} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Fluxo Limpo!</h2>
          <p className="text-slate-400 mt-2">Nenhum pedido pendente encontrado para o filtro aplicado.</p>
        </div>
      </div>
    );
  }

  const metaSlaDias = 20;

  // 3. Se houver dados, renderizamos os gráficos abaixo dos controles
  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-300">
      <BucketDetailsModal
        selectedBucket={selectedBucket}
        setSelectedBucket={setSelectedBucket}
        backlogAnalysis={backlogAnalysis}
        bucketSearchTerm={bucketSearchTerm}
        setBucketSearchTerm={setBucketSearchTerm}
        handleDownloadExcel={handleDownloadExcel}
      />

      {controlsPanel}

      {/* NOVO: RESUMO DO STATUS SINGRA DA FILA */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Network className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Status no SINGRA (Backlog Atual)</h3>
          <InfoButton title="Visão Cruzada" description="Mostra em qual etapa do SINGRA estão as RMs que compõem o seu Backlog selecionado no WMS." />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(backlogAnalysis.singraStatusSummary)
            .sort((a, b) => b[1] - a[1]) // Ordena do maior volume para o menor
            .map(([status, count]) => (
              <div key={status} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase leading-tight mb-2">{status}</p>
                <p className="text-2xl font-black text-indigo-600">{count}</p>
              </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 flex flex-col justify-between h-40">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Hourglass size={14} /> Total em Aberto</p>
            <InfoButton title="Volume em Aberto" description="Quantidade de pedidos pendentes no fluxo (considerando o filtro selecionado)." />
          </div>
          <p className="text-4xl font-black text-slate-800">{backlogAnalysis.totalPending}</p>
          <p className="text-xs text-slate-400 font-medium">{backlogStartDate || backlogEndDate || backlogTypeFilter !== "TODOS" ? "Visão filtrada" : "Visão histórica total"}</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 flex flex-col justify-between h-40">
          <div className="flex items-center justify-between">
             <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Clock size={14} /> Idade Média da Fila</p>
             <InfoButton title="Aging Médio" description="Média de dias de espera dos pedidos que ainda estão abertos no filtro atual." />
          </div>
          <p className="text-4xl font-black text-orange-600">{backlogAnalysis.avgAge} <span className="text-lg text-slate-400">dias</span></p>
          <p className="text-xs text-slate-400 font-medium">Tempo médio de fila</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 flex flex-col justify-between h-40 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><AlertTriangle size={14} /> Pedido Mais Antigo</p>
              <InfoButton title="Gargalo Crítico" description="O pedido que está há mais tempo parado na fila (considerando o filtro selecionado)." />
            </div>
            <p className="text-4xl font-black text-red-600">{backlogAnalysis.oldestOrder ? `${backlogAnalysis.oldestOrder.daysOpen} dias` : '-'}</p>
          </div>
          <AlertTriangle className="absolute -bottom-4 -right-4 text-red-50 opacity-50" size={120} />
        </div>
      </div>

      {/* NOVO GRÁFICO: SAZONALIDADE ANUAL (YoY) */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 mt-6 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="text-indigo-500" size={24} />
              <h3 className="text-lg font-black text-slate-800">Sazonalidade e Comportamento Anual (YoY)</h3>
              <InfoButton title="Sazonalidade" description="Sobreponha os anos para identificar tendências operacionais idênticas ao longo de meses específicos. Entradas são tracejadas; Saídas são sólidas." />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Filtro de Métricas */}
            <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setYoyMetrics(m => ({ ...m, entradas: !m.entradas }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${yoyMetrics.entradas ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
              >
                Entradas (Tracejado)
              </button>
              <button
                onClick={() => setYoyMetrics(m => ({ ...m, saidas: !m.saidas }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${yoyMetrics.saidas ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
              >
                Saídas (Sólido)
              </button>
            </div>

            {/* Filtro de Anos (Gerado dinamicamente) */}
            <div className="flex flex-wrap items-center gap-2">
              {yoyAnalysis.availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => toggleYoyYear(year)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedYoyYears.includes(year) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yoyAnalysis.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="monthName" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
              <YAxis tick={{fontSize: 10}} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '20px', fontWeight: 600 }} />

              {selectedYoyYears.map((year, idx) => {
                // Paleta de cores para não misturar os anos
                const colors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#8b5cf6'];
                const color = colors[idx % colors.length];

                return (
                  <Fragment key={year}>
                    {yoyMetrics.entradas && (
                      <Line type="monotone" dataKey={`${year}_entradas`} name={`Entradas ${year}`} stroke={color} strokeWidth={2.5} strokeDasharray="6 6" dot={{r: 3, fill: color}} activeDot={{r: 6}} />
                    )}
                    {yoyMetrics.saidas && (
                      <Line type="monotone" dataKey={`${year}_saidas`} name={`Saídas ${year}`} stroke={color} strokeWidth={3} dot={{r: 4, fill: color}} activeDot={{r: 7}} />
                    )}
                  </Fragment>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Activity className="text-indigo-500" /> Pedidos em processamento (Fila de Espera)</h3>
             <InfoButton title="Aging por Status" description="Distribuição dos pedidos pendentes por tempo de abertura. Clique nas barras para listar detalhes." />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backlogAnalysis.buckets} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 700}} axisLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Legend wrapperStyle={{fontSize: '10px'}} />
                {backlogAnalysis.uniqueStatuses.map((status) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      stackId="a"
                      fill={getStatusColor(status)}
                      barSize={32}
                      onClick={(d) => setSelectedBucket(d.payload)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ListFilter className="text-indigo-500" /> Onde estão parados?</h3>
             <InfoButton title="Status Operacional" description="Distribuição dos pedidos pendentes pelas etapas do WMS." />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={backlogAnalysis.statusChartData}
                  innerRadius={80}
                  outerRadius={110}
                  dataKey="value"
                  paddingAngle={4}
                >
                  {backlogAnalysis.statusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getStatusColor(entry.name)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip /><Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-200">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><AlertTriangle className="text-red-500" /> Top 10 Pedidos Críticos (Fila de Espera)</h3>
           <button
             onClick={() => handleDownloadExcel(backlogAnalysis.pendingOrders, `Relatorio_Backlog`)}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
           >
             <Download size={16} /> Exportar Lista Filtrada
           </button>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
               <tr><th className="px-6 py-4">Pedido</th><th className="px-6 py-4">Status Atual</th><th className="px-6 py-4">Data Entrada</th><th className="px-6 py-4 text-right">Dias em Aberto</th></tr>
             </thead>
             <tbody>
               {backlogAnalysis.topOffenders.length > 0 ? (
                 backlogAnalysis.topOffenders.map((order, idx) => (
                   <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4 font-bold text-slate-800 font-mono">{order.PEDIDO || order.PI || "S/N"}</td>
                     <td className="px-6 py-4"><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold border border-indigo-100">{order.STATUS}</span></td>
                     <td className="px-6 py-4 font-medium text-slate-500">{order.entryDateIso ? new Date(order.entryDateIso).toLocaleDateString('pt-BR') : '-'}</td>
                     <td className="px-6 py-4 text-right"><span className={`px-3 py-1 rounded-full text-xs font-black ${order.daysOpen > metaSlaDias ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{order.daysOpen} dias</span></td>
                   </tr>
                 ))
               ) : (
                 <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400 font-medium italic">Nenhum pedido pendente encontrado no filtro aplicado.</td></tr>
               )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

export default BacklogTab;
