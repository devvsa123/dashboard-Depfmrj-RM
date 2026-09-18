import { useState } from 'react';
import { XAxis, Brush, ComposedChart, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';
import InfoButton from './InfoButton';
import { PERIOD_PRESETS } from '../hooks/useDashboardAnalytics';

const COMPARISON_OPTIONS = [
  { key: 'previous', label: 'Período anterior' },
  { key: 'yearOverYear', label: 'Mesmo período ano passado' },
  { key: 'none', label: 'Sem comparação' }
];

// Seleção de período do dashboard: presets rápidos (7/30/90 dias, mês,
// ano), um intervalo customizado por data e a escolha de contra o que
// comparar. O Brush continua disponível para ajuste fino visual, mas deixa
// de ser a única forma de escolher um período — arrastar alças é ruim para
// acertar "o mês de março" ou "de 05/03 a 20/03" com precisão.
const PeriodSelector = ({
  chartData, visibleRange, setVisibleRange, selectedDateRange,
  activePresetKey, applyPreset, applyCustomRange,
  comparisonMode, setComparisonMode
}) => {
  const [customStart, setCustomStart] = useState(selectedDateRange?.startDate || '');
  const [customEnd, setCustomEnd] = useState(selectedDateRange?.endDate || '');

  const startIdx = visibleRange ? visibleRange.startIndex : 0;
  const endIdx = visibleRange ? visibleRange.endIndex : chartData.length - 1;

  const handleApplyCustom = () => {
    if (customStart && customEnd) applyCustomRange(customStart, customEnd);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Período de Análise</h3>
          <InfoButton
            title="Período de Análise"
            description="Escolha um período pronto, um intervalo de datas específico, ou ajuste manualmente pela barra de seleção. Todos os indicadores e gráficos desta aba respeitam o período escolhido aqui."
          />
        </div>
        <div className="text-sm font-semibold text-slate-600">
          {selectedDateRange && (
            <>{new Date(`${selectedDateRange.startDate}T00:00:00`).toLocaleDateString('pt-BR')} — {new Date(`${selectedDateRange.endDate}T00:00:00`).toLocaleDateString('pt-BR')}</>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activePresetKey === preset.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
          />
          <span className="text-slate-300 text-xs">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Aplicar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Comparar com:</span>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {COMPARISON_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setComparisonMode(opt.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${comparisonMode === opt.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[50px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <XAxis dataKey="date" hide />
            <Brush
              dataKey="date"
              height={32}
              stroke="#cbd5e1"
              fill="#f1f5f9"
              travellerWidth={12}
              startIndex={startIdx}
              endIndex={endIdx}
              onChange={(r) => {
                if (r && r.startIndex !== undefined && r.endIndex !== undefined) {
                  setVisibleRange({ startIndex: r.startIndex, endIndex: r.endIndex });
                }
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PeriodSelector;
