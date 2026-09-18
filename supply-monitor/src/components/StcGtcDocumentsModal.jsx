import { Download, FileWarning, X } from 'lucide-react';

const TYPE_LABEL = { STC: 'STC', GTC: 'GTC' };
const SITUACAO_LABEL = { parcial: 'Parciais', pendente: 'Pendentes' };

// Lista os DOCUMENTOS (STC/GTC) parciais ou pendentes — não os pedidos.
// Um documento agrupa vários pedidos, então o gestor precisa saber quais
// STC/GTC estão travados e para qual CAM (cliente/recebedor), não uma
// lista crua de linhas da planilha.
const StcGtcDocumentsModal = ({ selection, setSelection, documents, handleDownloadExcel }) => {
  if (!selection) return null;
  const { type, situacao } = selection;
  const doc = documents.find(d => d.type === type);
  const list = situacao === 'parcial' ? doc?.partialList || [] : doc?.pendingList || [];

  const handleDownload = () => {
    const allPedidos = list.flatMap(d => d.pedidos);
    handleDownloadExcel(allPedidos, `${TYPE_LABEL[type]}_${SITUACAO_LABEL[situacao]}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelection(null)}>
      <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2 text-slate-800"><FileWarning className="text-amber-500" />{TYPE_LABEL[type]} {SITUACAO_LABEL[situacao]}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Listando {list.length} documento(s) {TYPE_LABEL[type]} {situacao === 'parcial' ? 'com parte dos pedidos ainda não expedida' : 'sem nenhum pedido expedido ainda'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
            >
              <Download size={16} /> Baixar Pedidos
            </button>
            <button onClick={() => setSelection(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">{TYPE_LABEL[type]}</th>
                <th className="px-6 py-4">CAM</th>
                <th className="px-6 py-4 text-right">Pedidos</th>
                <th className="px-6 py-4 text-right">Pendentes</th>
                <th className="px-6 py-4 text-right">Idade Média</th>
                <th className="px-6 py-4 text-right">Mais Antigo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{d.stcKey}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{d.camList.join(', ')}</td>
                  <td className="px-6 py-4 text-right font-medium">{d.pedidosCount}</td>
                  <td className="px-6 py-4 text-right font-bold text-amber-600">{d.pedidosPendentesCount}</td>
                  <td className="px-6 py-4 text-right font-medium">{d.avgDaysOpen}d</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-700">{d.oldestDaysOpen}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StcGtcDocumentsModal;
