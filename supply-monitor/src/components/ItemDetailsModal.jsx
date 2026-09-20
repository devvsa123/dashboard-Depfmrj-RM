import { useState } from 'react';
import { Download, Package, X, ChevronLeft, FileText, Ban } from 'lucide-react';

// Detalhamento de um grupo de itens: do que ele é feito (as linhas, grades
// ou tamanhos que estão dentro dele) e como está a fila em aberto por
// status. Clicar em qualquer total abre a lista real dos pedidos.
const ItemDetailsModal = ({ selection, setSelection, rows, nivelFilhoLabel, handleDownloadExcel }) => {
  const [drillDown, setDrillDown] = useState(null);

  if (!selection) return null;
  const row = rows.find(r => r.chave === selection);
  const openPedidos = row?.openPedidos || [];
  const composicao = row?.composicao || [];
  const canceladosPedidos = row?.canceladosPedidos || [];
  const canceladosPorNome = row?.canceladosPorNome || [];

  const close = () => { setSelection(null); setDrillDown(null); };

  // Num recorte de cancelados não existe "dias em aberto" — o pedido não
  // está na fila, ele saiu dela. A última coluna vira a data de entrada.
  const soCancelados = Boolean(drillDown && drillDown.pedidos.every(p => p.status === 'CANCELADO'));
  const formatarData = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

  const statusGroups = new Map();
  openPedidos.forEach(p => {
    const key = p.status || 'SEM STATUS';
    if (!statusGroups.has(key)) statusGroups.set(key, []);
    statusGroups.get(key).push(p);
  });
  const statusRows = Array.from(statusGroups.entries()).sort(([, a], [, b]) => b.length - a.length);

  const abrir = (label, pedidos) => pedidos.length > 0 && setDrillDown({ label, pedidos });

  const handleDownload = () => {
    const lista = drillDown ? drillDown.pedidos : openPedidos;
    const nome = drillDown ? `${selection}_${drillDown.label}` : `${selection}_Em_Aberto`;
    handleDownloadExcel(lista, nome.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 80));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 min-w-0">
            {drillDown && (
              <button onClick={() => setDrillDown(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 shrink-0"><ChevronLeft size={20} /></button>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 truncate">
                <Package className="text-indigo-500 shrink-0" size={20} />
                {drillDown ? drillDown.label : selection}
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {drillDown
                  ? `${drillDown.pedidos.length} pedido(s) nesse recorte`
                  : `${row?.nomenclaturas || 0} nomenclatura(s) · ${row?.entradas || 0} entrada(s) no período · ${openPedidos.length} em aberto agora · ${canceladosPedidos.length} cancelado(s) no período`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(drillDown ? drillDown.pedidos.length > 0 : openPedidos.length > 0) && (
              <button onClick={handleDownload} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm">
                <Download size={16} /> Baixar
              </button>
            )}
            <button onClick={close} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {drillDown ? (
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Nomenclatura</th>
                  <th className="px-4 py-3">CAM</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">{soCancelados ? 'Entrada' : 'Dias em Aberto'}</th>
                </tr>
              </thead>
              <tbody>
                {drillDown.pedidos.map((p, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{p.PEDIDO}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{p.nomenclatura}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{String(p.CAM || '').trim() || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{p.status}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{soCancelados ? formatarData(p.dataEntrada) : p.daysOpen != null ? `${p.daysOpen}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-8">
              {composicao.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Composição por {nivelFilhoLabel} — entradas no período
                  </p>
                  <div className="space-y-2">
                    {composicao.slice(0, 15).map(c => (
                      <div key={c.nome} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <span className="font-bold text-slate-700 text-sm truncate pr-4">{c.nome}</span>
                        <span className="font-black text-slate-800 shrink-0">{c.qtd}</span>
                      </div>
                    ))}
                    {composicao.length > 15 && (
                      <p className="text-[11px] text-slate-400 italic">+ {composicao.length - 15} outros</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pedidos em Aberto por Status</p>
                {statusRows.length === 0 ? (
                  <p className="text-sm text-emerald-600 font-bold">Nenhum pedido em aberto para este grupo.</p>
                ) : (
                  <div className="space-y-2">
                    {statusRows.map(([status, pedidos]) => (
                      <button
                        key={status}
                        onClick={() => abrir(status, pedidos)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:shadow-sm transition-all text-left"
                      >
                        <span className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                          <FileText size={14} className="text-slate-400" /> {status}
                        </span>
                        <span className="font-black text-slate-800">{pedidos.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {canceladosPorNome.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">
                    Cancelados no Período — por nomenclatura
                  </p>
                  <div className="space-y-2">
                    {canceladosPorNome.slice(0, 15).map(c => (
                      <button
                        key={c.nome}
                        onClick={() => abrir(`Cancelados · ${c.nome}`, canceladosPedidos.filter(p => p.nomenclatura === c.nome))}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-red-100 bg-red-50/60 hover:bg-red-50 hover:shadow-sm transition-all text-left"
                      >
                        <span className="flex items-center gap-2 font-bold text-slate-700 text-sm truncate pr-4">
                          <Ban size={14} className="text-red-400 shrink-0" /> {c.nome}
                        </span>
                        <span className="font-black text-red-700 shrink-0">{c.qtd}</span>
                      </button>
                    ))}
                    {canceladosPorNome.length > 15 && (
                      <p className="text-[11px] text-slate-400 italic">+ {canceladosPorNome.length - 15} outras nomenclaturas canceladas</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetailsModal;
