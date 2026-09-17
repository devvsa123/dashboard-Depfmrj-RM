import { ArrowRightLeft, Download } from 'lucide-react';
import { safeGetISODate } from '../utils/dates';
import InfoButton from './InfoButton';

// Mostra apenas as falhas de interface (divergências onde o status do WMS
// e do SINGRA não coincidem logicamente). As demais situações de
// acompanhamento (aguardando retirada, aguardando arrecadação OMS,
// arrecadado pela OMS) ficam na aba de Indicadores.
const InterfaceTab = ({ interfaceAnalysis, selectedErrorFilter, setSelectedErrorFilter, handleDownloadExcel }) => {
  if (!interfaceAnalysis) return null;
  const currentList = interfaceAnalysis.falhasInterface;
  const displayedList = selectedErrorFilter
    ? currentList.filter(item => `${item.STATUS || 'N/A'}-${item.singraStatus || 'N/A'}` === selectedErrorFilter)
    : currentList;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black flex items-center gap-2 text-red-600">
            <ArrowRightLeft size={24} /> Falhas de Interface Sistêmica
            <InfoButton title="Falhas de Interface" description="Divergências críticas onde o status do pedido no WMS e no SINGRA não coincidem logicamente entre si — o cruzamento indica que algo precisa ser corrigido manualmente entre os dois sistemas." />
          </h3>
          <button onClick={() => handleDownloadExcel(displayedList, 'Falhas_Interface')} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"><Download size={16} /> Exportar Excel</button>
        </div>
        {currentList.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-10">Nenhuma falha de interface identificada.</p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default InterfaceTab;
