import { useState } from 'react';
import { Package, Search, ArrowUpDown, ChevronUp, ChevronDown, Layers, Hourglass, AlertTriangle } from 'lucide-react';
import InfoButton from './InfoButton';
import SectionLabel from './SectionLabel';
import ItemDetailsModal from './ItemDetailsModal';
import { NIVEIS } from '../hooks/useItemAnalysis';

const COLUMNS = [
  { key: 'chave', label: 'Item', align: 'left' },
  { key: 'classeAbc', label: 'ABC', align: 'center' },
  { key: 'entradas', label: 'Entradas', align: 'right' },
  { key: 'participacao', label: '% Volume', align: 'right', suffix: '%' },
  { key: 'acumuladoPct', label: '% Acum.', align: 'right', suffix: '%' },
  { key: 'expedidos', label: 'Expedidos', align: 'right' },
  { key: 'avgLeadTime', label: 'Tempo Médio', align: 'right', suffix: 'd' },
  { key: 'slaRate', label: 'SLA', align: 'right', suffix: '%' },
  { key: 'pendentes', label: 'Fila Atual', align: 'right' },
  { key: 'oldestPendente', label: 'Mais Antigo', align: 'right', suffix: 'd' },
  { key: 'nomenclaturas', label: 'Nomencl.', align: 'right' }
];

const ABC_TONE = {
  A: 'bg-indigo-100 text-indigo-700',
  B: 'bg-slate-100 text-slate-600',
  C: 'bg-slate-50 text-slate-400'
};

const fmt = (v, suffix) => (v === null || v === undefined ? '—' : `${v}${suffix || ''}`);

const SummaryTile = (props) => {
  const Icon = props.icon;
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Icon size={14} /></span>
        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">{props.title}</p>
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none">{props.value}</p>
      {props.context && <p className="text-xs text-slate-400 font-medium mt-1.5 leading-tight">{props.context}</p>}
    </div>
  );
};

// Visão por item. São milhares de nomenclaturas distintas, então a tabela
// nunca lista item a item: ela agrupa (família / linha / grade) e ordena
// pela curva ABC, que mostra os poucos grupos responsáveis pela maior
// parte do movimento. Clicar num grupo abre do que ele é feito e a fila
// em aberto por status.
const ItemAnalysisTab = ({ rows, summary, nivel, setNivel, search, setSearch, sortKey, sortDir, toggleSort, nivelFilhoLabel, handleDownloadExcel }) => {
  const [selection, setSelection] = useState(null);
  const nivelAtual = NIVEIS.find(n => n.key === nivel);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <ItemDetailsModal
        selection={selection}
        setSelection={setSelection}
        rows={rows}
        nivelFilhoLabel={nivelFilhoLabel}
        handleDownloadExcel={handleDownloadExcel}
      />

      <SectionLabel title="Análise por Item" description="Agrupada pela nomenclatura do WMS — volume, tempo de atendimento e fila em aberto" />

      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryTile
            icon={Layers}
            title="Grupos no Nível"
            value={summary.totalGrupos}
            context={`${summary.totalNomenclaturas.toLocaleString('pt-BR')} nomenclaturas distintas na base`}
          />
          <SummaryTile
            icon={Package}
            title="Classe A"
            value={summary.classeACount}
            context={`${summary.classeAShare}% de todas as entradas do período`}
          />
          <SummaryTile
            icon={Hourglass}
            title="Fila em Aberto"
            value={summary.totalPendentes.toLocaleString('pt-BR')}
            context={summary.maiorFila ? `Maior fila: ${summary.maiorFila.chave}` : 'Pedidos pendentes agora'}
          />
          <SummaryTile
            icon={AlertTriangle}
            title="Menor SLA"
            value={summary.piorSla ? `${summary.piorSla.slaRate}%` : '—'}
            context={summary.piorSla ? summary.piorSla.chave : 'Sem expedições suficientes no período'}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic text-center py-10 bg-white rounded-3xl border border-slate-200">Sem dados de item disponíveis.</p>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="text-indigo-500" size={20} />
              <h3 className="text-lg font-black text-slate-800">Detalhamento por Item</h3>
              <InfoButton
                title="Como os itens são agrupados"
                description="A nomenclatura do WMS segue o padrão peça + atributos + tamanho. Família é a peça (CALCA, SAPATO...); Linha é o modelo sem a peça, o que junta a calça, a gandola e o gorro do mesmo conjunto; Grade é o item com todos os tamanhos somados. A classe ABC ordena por volume: A são os grupos que somam até 80% das entradas, B até 95%, C o restante. Entradas, expedidos, tempo médio, SLA e a classe ABC seguem o período selecionado na aba Indicadores; fila e mais antigo são a situação atual. Clique numa linha para ver a composição do grupo e os pedidos em aberto."
              />
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar item..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 w-full md:w-64"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Agrupar por:</span>
            {NIVEIS.map(n => (
              <button
                key={n.key}
                onClick={() => setNivel(n.key)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${nivel === n.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {n.label}
              </button>
            ))}
            {nivelAtual && <span className="text-[11px] text-slate-400 font-medium ml-1">{nivelAtual.descricao}</span>}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-4 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.label}
                      {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.chave}
                  onClick={() => setSelection(r.chave)}
                  className={`border-b border-slate-50 hover:bg-indigo-50/60 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                >
                  <td className="px-4 py-3 font-bold text-slate-800 max-w-[280px] truncate" title={r.chave}>{r.chave}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${ABC_TONE[r.classeAbc]}`}>{r.classeAbc}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{r.entradas}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.participacao, '%')}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-400">{fmt(r.acumuladoPct, '%')}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.expedidos}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.avgLeadTime, 'd')}</td>
                  <td className={`px-4 py-3 text-right font-bold ${r.slaRate != null && r.slaRate < 70 ? 'text-red-600' : r.slaRate != null && r.slaRate < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(r.slaRate, '%')}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{r.pendentes}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.oldestPendente, 'd')}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-400">{r.nomenclaturas}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-400 italic">Nenhum item encontrado para essa busca.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ItemAnalysisTab;
