import { Package, X } from 'lucide-react';
import { safeGetISODate } from '../utils/dates';

const PiDetailsModal = ({ selectedPiSegment, setSelectedPiSegment, chartData, visibleRange, data }) => {
  if (!selectedPiSegment) return null;
  const startIndex = visibleRange ? visibleRange.startIndex : 0;
  const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
  const startDate = new Date(chartData[startIndex]?.date);
  const endDate = new Date(chartData[endIndex]?.date);
  const targetType = selectedPiSegment;

  const filteredList = data.filter(item => {
    const d = safeGetISODate(item.DATA_ENTRADA);
    if (!d) return false;
    const itemDate = new Date(d);
    if (itemDate < startDate || itemDate > endDate) return false;
    const status = String(item.STATUS || "").toUpperCase().trim();
    if (!item.PI) return false;
    return targetType === 'cancelled' ? status === "CANCELADO" : status === "EXPEDIDO";
  });

  const title = targetType === 'cancelled' ? 'PIs Cancelados no Período' : 'PIs Entregues no Período';
  const colorClass = targetType === 'cancelled' ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelectedPiSegment(null)}>
      <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className={`text-xl font-black flex items-center gap-2 ${colorClass}`}><Package />{title}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Listando {filteredList.length} registros no período selecionado</p>
          </div>
          <button onClick={() => setSelectedPiSegment(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr><th className="px-6 py-4">PI</th><th className="px-6 py-4">Pedido</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Data Entrada</th></tr>
            </thead>
            <tbody>
              {filteredList.map((order, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{order.PI || "-"}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{order.PEDIDO || "S/N"}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold border ${targetType === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{order.STATUS}</span></td>
                  <td className="px-6 py-4 font-medium">{order.DATA_ENTRADA ? safeGetISODate(order.DATA_ENTRADA).split('-').reverse().join('/') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PiDetailsModal;
