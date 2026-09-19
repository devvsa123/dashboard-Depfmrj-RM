import { useState } from 'react';
import { Users, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import InfoButton from './InfoButton';
import CamDetailsModal from './CamDetailsModal';

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

// Visão consolidada por CAM (o recebedor/cliente de cada RM): quantos
// pedidos, quantos documentos STC/GTC, tempo médio de atendimento, nível
// de serviço e fila em aberto — tudo numa única tabela ordenável, já que
// o número de CAMs distintos costuma ser grande demais para um cartão por
// CAM fazer sentido visualmente. Clicar num CAM abre o detalhamento dos
// pedidos em aberto (documentação e status).
const CamAnalysisCard = ({ rows, search, setSearch, sortKey, sortDir, toggleSort, handleDownloadExcel }) => {
  const [selectedCam, setSelectedCam] = useState(null);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <CamDetailsModal camName={selectedCam} setCamName={setSelectedCam} rows={rows} handleDownloadExcel={handleDownloadExcel} />

      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Análise por CAM</h3>
          <InfoButton
            title="Análise por CAM"
            description="Entradas, expedidos, tempo médio, SLA, STC, GTC e Cancelados seguem o período selecionado mais acima. Fila em aberto (pendentes, idade média, mais antigo) é a situação atual, independente do período. O SLA usa a meta de prazo do documento de cada pedido — GTC: 10 dias, STC: 45 dias — e 20 dias para pedidos ainda sem STC/GTC atribuído. Clique num cabeçalho para ordenar, ou numa linha para ver o detalhamento dos pedidos em aberto daquele CAM."
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
              <tr
                key={r.cam}
                onClick={() => setSelectedCam(r.cam)}
                className={`border-b border-slate-50 hover:bg-indigo-50/60 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
              >
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
  );
};

export default CamAnalysisCard;
