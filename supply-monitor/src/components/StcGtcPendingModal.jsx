import { Download, FileWarning, X } from 'lucide-react';

const TYPE_LABEL = { STC: 'STC', GTC: 'GTC' };

// Lista os pedidos com STC/GTC atribuído que ainda não foram expedidos —
// a fila específica de documentos, separada da fila geral de RMs.
const StcGtcPendingModal = ({ pendingType, setPendingType, pendingOrders, handleDownloadExcel }) => {
  if (!pendingType) return null;

  const orders = pendingOrders.filter(o => o.tipoDocumento === pendingType);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setPendingType(null)}>
      <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2 text-slate-800"><FileWarning className="text-amber-500" />{TYPE_LABEL[pendingType]} Pendentes</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Listando {orders.length} pedido(s) com {TYPE_LABEL[pendingType]} atribuído e ainda não expedido</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadExcel(orders, `Pendentes_${pendingType}`)}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
            >
              <Download size={16} /> Baixar
            </button>
            <button onClick={() => setPendingType(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Pedido</th>
                <th className="px-6 py-4">{TYPE_LABEL[pendingType]}</th>
                <th className="px-6 py-4">Status Atual</th>
                <th className="px-6 py-4">Data Entrada</th>
                <th className="px-6 py-4 text-right">Dias em Aberto</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{order.PEDIDO || order.RM || "S/N"}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{order.STC}</td>
                  <td className="px-6 py-4"><span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-xs font-bold border border-amber-100">{order.STATUS}</span></td>
                  <td className="px-6 py-4 font-medium">{order.entryDateIso ? new Date(order.entryDateIso).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-700">{order.daysOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StcGtcPendingModal;
