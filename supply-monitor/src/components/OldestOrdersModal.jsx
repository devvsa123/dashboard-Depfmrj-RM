import { Download, Hourglass, X } from 'lucide-react';

// Lista os pedidos em aberto de um grupo (STC / GTC / sem documento) que já
// passaram da meta de idade máxima daquele grupo — clicado a partir do
// contador "N pedido(s) acima da meta" no painel de Metas e Progresso.
const OldestOrdersModal = ({ selection, setSelection, handleDownloadExcel }) => {
  if (!selection) return null;
  const { label, target, pedidos } = selection;

  const handleDownload = () => handleDownloadExcel(pedidos, `Acima_da_Meta_${label}`.replace(/\s+/g, '_'));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelection(null)}>
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2 text-slate-800"><Hourglass className="text-red-500" />{label}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{pedidos.length} pedido(s) em aberto com mais de {target} dia(s) — meta do grupo</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
            >
              <Download size={16} /> Baixar
            </button>
            <button onClick={() => setSelection(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Pedido</th>
                <th className="px-6 py-4">STC/GTC</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Dias em Aberto</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-800">{p.PEDIDO}</td>
                  <td className="px-6 py-4 font-mono text-slate-600">{String(p.STC || '').trim() || '-'}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{p.STATUS}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-600">{p.daysOpen}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OldestOrdersModal;
