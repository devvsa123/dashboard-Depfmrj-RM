import { useState } from 'react';
import { Download, Users, X, ChevronLeft, FileText } from 'lucide-react';
import { classifyStc } from '../hooks/useStcGtcAnalysis';

const DOC_LABEL = { STC: 'Com STC', GTC: 'Com GTC', NONE: 'Sem Documento' };
const DOC_COLOR = {
  STC: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', label: 'text-indigo-500' },
  GTC: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', label: 'text-amber-500' },
  NONE: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', label: 'text-slate-400' }
};

// Analisa só os pedidos EM ABERTO (não expedidos, não cancelados) de um
// CAM: quantos já têm STC/GTC atribuído e quantos ainda não, e quantos
// pedidos há em cada status. Clicar num total dessas duas visões mostra a
// lista real dos pedidos por trás do número.
const CamDetailsModal = ({ camName, setCamName, rows, handleDownloadExcel }) => {
  const [drillDown, setDrillDown] = useState(null); // { label, pedidos }

  if (!camName) return null;
  const row = rows.find(r => r.cam === camName);
  const openPedidos = row?.openPedidos || [];

  const close = () => { setCamName(null); setDrillDown(null); };

  const docGroups = { STC: [], GTC: [], NONE: [] };
  openPedidos.forEach(p => { docGroups[classifyStc(p.STC) || 'NONE'].push(p); });

  const statusGroups = new Map();
  openPedidos.forEach(p => {
    const key = p.status || 'SEM STATUS';
    if (!statusGroups.has(key)) statusGroups.set(key, []);
    statusGroups.get(key).push(p);
  });
  const statusRows = Array.from(statusGroups.entries()).sort(([, a], [, b]) => b.length - a.length);

  const openDrillDown = (label, pedidos) => pedidos.length > 0 && setDrillDown({ label, pedidos });

  const handleDownload = () => {
    if (drillDown) handleDownloadExcel(drillDown.pedidos, `${camName}_${drillDown.label}`.replace(/\s+/g, '_'));
    else handleDownloadExcel(openPedidos, `${camName}_Em_Aberto`.replace(/\s+/g, '_'));
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
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 truncate">
                <Users className="text-indigo-500 shrink-0" size={22} />
                {drillDown ? drillDown.label : camName}
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {drillDown
                  ? `${drillDown.pedidos.length} pedido(s) em aberto nesse recorte`
                  : `${openPedidos.length} pedido(s) em aberto agora (situação atual, não filtrada pelo período do dashboard)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(drillDown ? drillDown.pedidos.length > 0 : openPedidos.length > 0) && (
              <button
                onClick={handleDownload}
                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
              >
                <Download size={16} /> Baixar
              </button>
            )}
            <button onClick={close} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {openPedidos.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-10">Nenhum pedido em aberto para este CAM.</p>
          ) : drillDown ? (
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">STC/GTC</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Dias em Aberto</th>
                </tr>
              </thead>
              <tbody>
                {drillDown.pedidos.map((p, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{p.PEDIDO}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{String(p.STC || '').trim() || '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{p.status}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{p.daysOpen != null ? `${p.daysOpen}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documentação dos Pedidos em Aberto</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['STC', 'GTC', 'NONE'].map(key => {
                    const list = docGroups[key];
                    const tone = DOC_COLOR[key];
                    return (
                      <button
                        key={key}
                        onClick={() => openDrillDown(DOC_LABEL[key], list)}
                        disabled={list.length === 0}
                        className={`p-4 rounded-2xl border text-left transition-all ${tone.bg} ${tone.border} ${list.length > 0 ? 'hover:shadow-sm cursor-pointer' : 'opacity-50 cursor-default'}`}
                      >
                        <p className={`text-2xl font-black ${tone.text}`}>{list.length}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${tone.label}`}>{DOC_LABEL[key]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pedidos em Aberto por Status</p>
                <div className="space-y-2">
                  {statusRows.map(([status, pedidos]) => (
                    <button
                      key={status}
                      onClick={() => openDrillDown(status, pedidos)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:shadow-sm transition-all text-left"
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <FileText size={14} className="text-slate-400" /> {status}
                      </span>
                      <span className="font-black text-slate-800">{pedidos.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CamDetailsModal;
