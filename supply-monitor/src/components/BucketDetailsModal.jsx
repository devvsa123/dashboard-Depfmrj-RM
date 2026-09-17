import { Download, ListFilter, Search, X } from 'lucide-react';

const BucketDetailsModal = ({ selectedBucket, setSelectedBucket, backlogAnalysis, bucketSearchTerm, setBucketSearchTerm, handleDownloadExcel }) => {
  if (!selectedBucket) return null;

  // 1. Filtra primeiro os pedidos que pertencem ao bucket selecionado
  const baseOrders = backlogAnalysis.pendingOrders.filter(
    order => order.daysOpen >= selectedBucket.min && order.daysOpen <= selectedBucket.max
  );

  // 2. Aplica o filtro de texto (busca por Pedido ou Status)
  const filteredOrders = baseOrders.filter(order => {
    const term = bucketSearchTerm.toLowerCase();
    const pedido = String(order.PEDIDO || "S/N").toLowerCase();
    const status = String(order.STATUS || "").toLowerCase();
    return pedido.includes(term) || status.includes(term);
  });

  // Função para limpar o filtro ao fechar o modal
  const handleClose = () => {
    setSelectedBucket(null);
    setBucketSearchTerm("");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* CABEÇALHO DO MODAL */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <ListFilter className="text-indigo-600" /> Detalhamento: {selectedBucket.name}
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Listando {filteredOrders.length} de {baseOrders.length} pedidos nesta faixa
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* CAMPO DE BUSCA */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Filtrar RM ou Status..."
                value={bucketSearchTerm}
                onChange={(e) => setBucketSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-sm w-full md:w-56"
              />
            </div>

            {/* BOTÃO DE DOWNLOAD */}
            <button
              onClick={() => handleDownloadExcel(filteredOrders, `Backlog_${selectedBucket.name.replace(/\s/g, '')}`)}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm whitespace-nowrap"
            >
              <Download size={16} /> Baixar
            </button>

            {/* BOTÃO FECHAR */}
            <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* TABELA DE DADOS */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4">Pedido</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Data Entrada</th>
                <th className="px-6 py-4 text-right">Dias na Fila</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{order.PEDIDO || "S/N"}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">
                        {order.STATUS}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{new Date(order.entryDateIso).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-700">{order.daysOpen}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-slate-400 font-medium italic">
                    Nenhum pedido encontrado com o filtro "{bucketSearchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BucketDetailsModal;
