import { Users, Search, ArrowUpDown, ChevronUp, ChevronDown, LogIn, Target, Hourglass } from 'lucide-react';
import InfoButton from './InfoButton';
import SectionLabel from './SectionLabel';

const COLUMNS = [
  { key: 'cam', label: 'CAM', align: 'left' },
  { key: 'entradas', label: 'Entradas', align: 'right' },
  { key: 'expedidos', label: 'Expedidos', align: 'right' },
  { key: 'avgLeadTime', label: 'Tempo Médio', align: 'right', suffix: 'd' },
  { key: 'slaRate', label: 'SLA', align: 'right', suffix: '%' },
  { key: 'pendentes', label: 'Fila Atual', align: 'right' },
  { key: 'avgAgePendentes', label: 'Idade Média', align: 'right', suffix: 'd' },
  { key: 'oldestPendente', label: 'Mais Antigo', align: 'right', suffix: 'd' },
  { key: 'stcCount', label: 'STC', align: 'right' },
  { key: 'gtcCount', label: 'GTC', align: 'right' },
  { key: 'cancelados', label: 'Cancelados', align: 'right' }
];

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
      {props.context && <p className="text-xs text-slate-400 font-medium mt-1.5">{props.context}</p>}
    </div>
  );
};

// Visão consolidada por CAM (o recebedor/cliente de cada RM): quantos
// pedidos, quantos documentos STC/GTC, tempo médio de atendimento, nível
// de serviço e fila em aberto — tudo numa única tabela ordenável, já que
// o número de CAMs distintos costuma ser grande demais para um cartão por
// CAM fazer sentido visualmente.
const CamAnalysisTab = ({ rows, summary, search, setSearch, sortKey, sortDir, toggleSort }) => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <SectionLabel title="Análise por CAM" description="Volume, tempo de atendimento e fila em aberto agrupados por CAM (recebedor/cliente)" />

      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryTile icon={Users} title="CAMs Ativos" value={summary.totalCams} context="Com pelo menos 1 pedido" />
          <SummaryTile icon={LogIn} title="Entradas no Período" value={summary.totalEntradas.toLocaleString()} context="Soma de todos os CAMs" />
          <SummaryTile icon={Target} title="SLA Médio" value={summary.avgSla != null ? `${summary.avgSla}%` : '—'} context="Média simples entre CAMs com expedição no período" />
          <SummaryTile icon={Hourglass} title="Fila em Aberto" value={summary.totalPendentes.toLocaleString()} context="Pedidos pendentes agora, todos os CAMs" />
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic text-center py-10 bg-white rounded-3xl border border-slate-200">Sem dados de CAM disponíveis.</p>
      )}

      {summary && (summary.topVolume || summary.worstSla) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {summary.topVolume && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Maior Volume no Período</p>
              <p className="text-sm font-bold text-indigo-800">{summary.topVolume.cam} — {summary.topVolume.entradas} entrada(s)</p>
            </div>
          )}
          {summary.worstSla && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Menor Nível de Serviço no Período</p>
              <p className="text-sm font-bold text-red-800">{summary.worstSla.cam} — {summary.worstSla.slaRate}% dentro do prazo</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-500" size={20} />
            <h3 className="text-lg font-black text-slate-800">Detalhamento por CAM</h3>
            <InfoButton
              title="Detalhamento por CAM"
              description="Entradas, expedidos, tempo médio e SLA seguem o período selecionado na aba Indicadores. Fila em aberto (pendentes, idade média, mais antigo) é a situação atual, independente do período. Clique em um cabeçalho de coluna para ordenar."
            />
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar CAM..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 w-full md:w-64"
            />
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
                    className={`px-4 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
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
                <tr key={r.cam} className={`border-b border-slate-50 hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-800">{r.cam}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.entradas}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.expedidos}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.avgLeadTime, 'd')}</td>
                  <td className={`px-4 py-3 text-right font-bold ${r.slaRate != null && r.slaRate < 70 ? 'text-red-600' : r.slaRate != null && r.slaRate < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(r.slaRate, '%')}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{r.pendentes}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.avgAgePendentes, 'd')}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.oldestPendente, 'd')}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.stcCount}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.gtcCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-400">{r.cancelados}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-400 italic">Nenhum CAM encontrado para essa busca.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CamAnalysisTab;
