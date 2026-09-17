import { Search, Bookmark, Trash2, Save, Download } from 'lucide-react';

const EmailSearchTab = ({
  emailText, setEmailText, extractedOrders, emailResultsSummary,
  savedSearches, newSearchName, setNewSearchName, handleSaveSearch, handleDeleteSearch,
  handleDownloadExcel
}) => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Search className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Extrator de RM por E-mail</h3>
        </div>

        {/* NOVO: PAINEL DE CONSULTAS SALVAS */}
        {savedSearches.length > 0 && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bookmark size={14} /> Sitreps Salvos
            </p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map(s => (
                <div key={s.id} className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-indigo-300 transition-all">
                  <button
                    onClick={() => setEmailText(s.text)}
                    className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    title="Carregar esta lista"
                  >
                    {s.name}
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200"></div>
                  <button
                    onClick={() => handleDeleteSearch(s.id)}
                    className="px-2 py-2 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Excluir lista"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-slate-500 mb-4 font-medium">Cole o texto do e-mail abaixo. O sistema buscará automaticamente padrões numéricos de 8 dígitos e cruzará os status.</p>
        <textarea
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          placeholder="Cole o texto do e-mail aqui..."
          className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
        />

        {/* NOVO: BOTÃO DE SALVAR CONSULTA ATUAL */}
        {emailText.trim() && (
          <div className="mt-4 flex flex-col md:flex-row items-center gap-3">
            <input
              type="text"
              value={newSearchName}
              onChange={e => setNewSearchName(e.target.value)}
              placeholder="Ex: Pedido Whatsapp CMG Joao..."
              className="w-full md:max-w-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-sm"
            />
            <button
              onClick={handleSaveSearch}
              disabled={!newSearchName.trim()}
              className="w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> Salvar Lote
            </button>
          </div>
        )}
      </div>

      {extractedOrders.length > 0 && (
        <div className="space-y-6">
          {/* RESUMO POR SITUAÇÃO (Já implementado antes) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {emailResultsSummary.map(([status, count]) => (
              <div key={status} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase leading-tight mb-1">{status}</p>
                <p className="text-xl font-black text-indigo-600">{count}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <h3 className="text-lg font-black text-slate-800">Resultados Encontrados ({extractedOrders.length})</h3>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadExcel(extractedOrders, `Busca_Email_RM`)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  <Download size={16} /> Exportar Excel
                </button>

                <button
                  onClick={() => setEmailText("")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Limpar Busca
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl">CAM</th>
                    <th className="px-6 py-4">RM Extraída</th>
                    <th className="px-6 py-4">CAPA</th>
                    <th className="px-6 py-4">STC</th>
                    <th className="px-6 py-4">Status WMS</th>
                    <th className="px-6 py-4">Status SINGRA</th>
                    <th className="px-6 py-4">Data Entrada</th>
                    <th className="px-6 py-4">Data de Expedição</th>
                    <th className="px-6 py-4 rounded-tr-xl">LOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedOrders.map((res, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-600">{res.cam}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 font-mono">{res.idOriginal}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{res.capa}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">{res.stc}</td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold border ${res.wmsStatus === 'NÃO LOCALIZADO' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                           {res.wmsStatus}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold border ${res.singraStatus === 'NÃO CONSTA' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-800 text-white border-slate-700'}`}>
                           {res.singraStatus}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500">
                        {res.dataEntrada ? res.dataEntrada.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500">
                        {res.dataSeparacao ? res.dataSeparacao.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-600">{res.lote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSearchTab;
