import { Calendar, ArrowRightLeft, Download } from 'lucide-react';
import { safeGetISODate } from '../utils/dates';
import InfoButton from './InfoButton';

const InterfaceTab = ({
  interfaceAnalysis, activeInterfaceView, setActiveInterfaceView,
  selectedErrorFilter, setSelectedErrorFilter,
  interfaceStartDate, setInterfaceStartDate, interfaceEndDate, setInterfaceEndDate,
  handleDownloadExcel
}) => {
  if (!interfaceAnalysis) return null;
  const views = {
    aguardandoRetirada: { title: "Aguardando Retirada de Material", data: interfaceAnalysis.aguardandoRetirada, color: "text-blue-600", bg: "bg-blue-50", desc: "Pedidos em trânsito no SINGRA e conferidos no WMS." },
    aguardandoArrecadacao: { title: "Aguardando Arrecadação OMS", data: interfaceAnalysis.aguardandoArrecadacao, color: "text-orange-600", bg: "bg-orange-50", desc: "Expedidos fisicamente, mas sem baixa no SINGRA." },
    arrecadadoOms: { title: "Arrecadado pela OMS", data: interfaceAnalysis.arrecadadoOms, color: "text-emerald-600", bg: "bg-emerald-50", desc: "Finalizados com sucesso nos dois sistemas." },
    falhasInterface: { title: "Falhas de Interface Sistêmica", data: interfaceAnalysis.falhasInterface, color: "text-red-600", bg: "bg-red-50", desc: "Divergências críticas onde os status não coincidem logicamente." }
  };
  const currentList = views[activeInterfaceView].data;
  const displayedList = activeInterfaceView === 'falhasInterface' && selectedErrorFilter
      ? currentList.filter(item => `${item.STATUS || 'N/A'}-${item.singraStatus || 'N/A'}` === selectedErrorFilter)
      : currentList;
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-1"><Calendar size={16} className="text-indigo-500" /> Filtro de Período (Arrecadados OMS)</h3>
          <p className="text-xs text-slate-500 font-medium">
            Como os pedidos "Arrecadados" não constam mais no SINGRA, nós filtramos a busca por data de entrada para não travar o sistema com o histórico completo de 5 anos. <span className="text-indigo-500 font-bold">Os demais status ("Descasados", "Em Trânsito") não sofrem esse filtro para garantir que nenhum erro antigo seja esquecido.</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input type="date" value={interfaceStartDate} onChange={e => setInterfaceStartDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm" />
          <input type="date" value={interfaceEndDate} onChange={e => setInterfaceEndDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(views).map(([key, view]) => (
          <div
            key={key}
            role="button"
            tabIndex={0}
            onClick={() => { setActiveInterfaceView(key); setSelectedErrorFilter(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActiveInterfaceView(key); setSelectedErrorFilter(null); } }}
            className={`cursor-pointer text-left p-6 rounded-3xl border-2 transition-all ${activeInterfaceView === key ? 'border-indigo-400 bg-white shadow-sm scale-105' : 'border-transparent ' + view.bg + ' opacity-70 hover:opacity-100'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
               <p className={`text-[10px] font-black uppercase leading-tight ${view.color}`}>{view.title}</p>
               <InfoButton title={view.title} description={view.desc} />
            </div>
            <p className="text-3xl font-black text-slate-800 mt-2">{view.data.length}</p>
          </div>
        ))}
      </div>
      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6">
           <h3 className={`text-xl font-black flex items-center gap-2 ${views[activeInterfaceView].color}`}><ArrowRightLeft size={24} /> {views[activeInterfaceView].title}</h3>
           <button onClick={() => handleDownloadExcel(displayedList, `Interface_${activeInterfaceView}`)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"><Download size={16} /> Exportar Excel</button>
         </div>
         {activeInterfaceView === 'falhasInterface' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
               {Object.values(currentList.reduce((acc, item) => {
                   const key = `${item.STATUS || 'N/A'}-${item.singraStatus || 'N/A'}`;
                   if (!acc[key]) acc[key] = { key, wms: item.STATUS || 'N/A', singra: item.singraStatus || 'N/A', count: 0 };
                   acc[key].count++;
                   return acc;
               }, {})).map(s => (
                  <div key={s.key} onClick={() => setSelectedErrorFilter(s.key === selectedErrorFilter ? null : s.key)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedErrorFilter === s.key ? 'border-red-500 bg-red-50 shadow-md scale-105' : 'border-slate-100 bg-slate-50 hover:border-red-200'}`}>
                     <p className="text-[9px] font-bold text-slate-400">WMS: {s.wms}</p>
                     <p className="text-[9px] font-bold text-slate-400">SINGRA: {s.singra}</p>
                     <p className="text-lg font-black text-red-600">{s.count}</p>
                  </div>
               ))}
            </div>
         )}
         <div className="overflow-x-auto max-h-[400px]">
           <table className="w-full text-sm text-left text-slate-600">
             <thead className="bg-slate-50 text-slate-400 uppercase text-xs sticky top-0 z-10">
               <tr><th className="px-6 py-4">Pedido / RM</th><th className="px-6 py-4">PI</th><th className="px-6 py-4">Status WMS</th><th className="px-6 py-4">Status SINGRA</th><th className="px-6 py-4">Data Entrada</th></tr>
             </thead>
             <tbody>
               {displayedList.map((o, i) => (
                 <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                   <td className="px-6 py-4 font-bold text-slate-800 font-mono">{o.PEDIDO || "S/N"}</td>
                   <td className="px-6 py-4 font-medium text-slate-500">{o.PI || "-"}</td>
                   <td className="px-6 py-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-100">{o.STATUS || "N/A"}</span></td>
                   <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold border ${o.singraStatus === 'NÃO CONSTA NO SINGRA' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-white'}`}>{o.singraStatus || "N/A"}</span></td>
                   <td className="px-6 py-4 font-medium">{o.DATA_ENTRADA ? safeGetISODate(o.DATA_ENTRADA).split('-').reverse().join('/') : '-'}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

export default InterfaceTab;
