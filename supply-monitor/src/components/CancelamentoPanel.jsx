import { useState } from 'react';
import { Ban, Download, X, TrendingDown, AlertOctagon } from 'lucide-react';
import InfoButton from './InfoButton';

// Ranking de cancelamento por nomenclatura. O cancelamento é o item que o
// depósito não conseguiu atender, então ele precisa aparecer pelo nome
// exato — "TENIS EDUCACAO FISICA 42", e não "TENIS". Dois cortes, porque
// respondem perguntas diferentes:
//   Volume — onde está a maior parte dos cancelamentos (o que atacar primeiro)
//   Taxa   — o item que quase nunca sai, mesmo aparecendo pouco (ruptura crônica)
const CRITERIOS = [
  { key: 'volume', label: 'Mais cancelados', icon: Ban },
  { key: 'taxa', label: 'Maior % de cancelamento', icon: TrendingDown }
];

const toneTaxa = (t) =>
  t == null ? 'text-slate-400' : t >= 50 ? 'text-red-600' : t >= 20 ? 'text-amber-600' : 'text-slate-600';

const CancelamentoModal = ({ item, onClose, handleDownloadExcel }) => {
  if (!item) return null;
  const baixar = () => handleDownloadExcel(
    item.pedidos,
    `Cancelados_${item.nome.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 70)}`
  );
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
          <div className="min-w-0">
            <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
              <Ban className="text-red-500 shrink-0" size={20} />
              <span className="truncate">{item.nome}</span>
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {item.cancelados} cancelamento(s) em {item.movimentos} pedido(s) no período
              {item.taxa != null && ` · ${item.taxa}% da demanda desse item`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={baixar} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition-colors shadow-sm">
              <Download size={16} /> Baixar
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">CAM</th>
                <th className="px-4 py-3">Tipo RM</th>
                <th className="px-4 py-3">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {item.pedidos.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{p.PEDIDO}</td>
                  <td className="px-4 py-3 text-xs">{String(p.CAM || '').trim() || '—'}</td>
                  <td className="px-4 py-3 text-xs">{String(p.TIPO_RM || '').trim() || '—'}</td>
                  <td className="px-4 py-3 text-xs">{p.dataEntrada ? p.dataEntrada.split('-').reverse().join('/') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CancelamentoPanel = ({ cancelamento, handleDownloadExcel }) => {
  const [criterio, setCriterio] = useState('volume');
  const [aberto, setAberto] = useState(null);

  if (!cancelamento || cancelamento.totalCancelados === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Ban className="text-slate-300" size={20} /> Itens Mais Cancelados</h3>
        <p className="text-sm text-emerald-600 font-bold mt-3">Nenhum pedido cancelado no período selecionado.</p>
      </div>
    );
  }

  const lista = criterio === 'volume' ? cancelamento.porVolume : cancelamento.porTaxa;
  const maxValor = lista.length
    ? Math.max(...lista.map(n => (criterio === 'volume' ? n.cancelados : n.taxa || 0)))
    : 1;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <CancelamentoModal item={aberto} onClose={() => setAberto(null)} handleDownloadExcel={handleDownloadExcel} />

      <div className="p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="text-red-500" size={20} />
            <h3 className="text-lg font-black text-slate-800">Itens Mais Cancelados</h3>
            <InfoButton
              title="Como ler o cancelamento por item"
              description={`O ranking é pela nomenclatura completa do WMS, com tamanho — é o item exato que não foi atendido. Só entram pedidos cancelados cuja entrada caiu no período selecionado. "Mais cancelados" ordena pelo volume: é onde está a maior parte do problema. "Maior % de cancelamento" mostra a proporção de pedidos daquele item que acabaram cancelados, considerando apenas nomenclaturas com pelo menos ${cancelamento.minMovimentos} pedidos no período — sem esse piso o ranking vira uma lista de itens com um único pedido cancelado. Clique numa linha para ver os pedidos cancelados e exportar.`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CRITERIOS.map(c => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  onClick={() => setCriterio(c.key)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${criterio === c.key ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Icon size={13} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Cancelados no Período</p>
            <p className="text-2xl font-black text-red-700 leading-none mt-1.5">{cancelamento.totalCancelados.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">% do Total de Pedidos</p>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1.5">{cancelamento.taxaGeral != null ? `${cancelamento.taxaGeral}%` : '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomenclaturas Afetadas</p>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1.5">{cancelamento.nomenclaturasAfetadas.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso do Top {cancelamento.topN}</p>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1.5">{cancelamento.concentracaoTopN != null ? `${cancelamento.concentracaoTopN}%` : '—'}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
        {lista.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-slate-400 italic">
            Nenhuma nomenclatura com pelo menos {cancelamento.minMovimentos} pedidos no período.
          </p>
        )}
        {lista.map((n, idx) => {
          const valor = criterio === 'volume' ? n.cancelados : n.taxa || 0;
          const largura = maxValor > 0 ? Math.max(4, (valor / maxValor) * 100) : 0;
          return (
            <button
              key={n.nome}
              onClick={() => setAberto(n)}
              className="w-full px-6 py-3 flex items-center gap-4 hover:bg-red-50/50 transition-colors text-left"
            >
              <span className={`w-6 shrink-0 text-center text-xs font-black ${idx < 3 ? 'text-red-600' : 'text-slate-300'}`}>{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate" title={n.nome}>{n.nome}</p>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${idx < 3 ? 'bg-red-500' : 'bg-red-300'}`} style={{ width: `${largura}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right w-24">
                <p className="font-black text-slate-800 leading-none">{n.cancelados}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">de {n.movimentos} pedidos</p>
              </div>
              <div className="shrink-0 text-right w-16">
                <p className={`font-black leading-none ${toneTaxa(n.taxa)}`}>{n.taxa != null ? `${n.taxa}%` : '—'}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">cancel.</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CancelamentoPanel;
