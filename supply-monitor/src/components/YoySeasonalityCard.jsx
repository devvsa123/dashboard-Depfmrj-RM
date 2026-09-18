import { Fragment } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';
import InfoButton from './InfoButton';

// Paleta usada para não misturar visualmente os anos sobrepostos no gráfico.
const YEAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#8b5cf6'];

// Sazonalidade: sobrepõe os anos disponíveis para comparar o mesmo mês entre
// safras diferentes e identificar padrões que se repetem todo ano.
const YoySeasonalityCard = ({ yoyAnalysis, selectedYoyYears, toggleYoyYear, yoyMetrics, setYoyMetrics }) => {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="text-indigo-500" size={24} />
          <h3 className="text-lg font-black text-slate-800">Sazonalidade: Comparativo Entre Anos</h3>
          <InfoButton
            title="Comparativo Entre Anos"
            description="Sobreponha os anos para identificar se determinados meses repetem o mesmo comportamento ano após ano. Entradas aparecem tracejadas; Saídas aparecem em linha sólida."
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setYoyMetrics(m => ({ ...m, entradas: !m.entradas }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${yoyMetrics.entradas ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              Entradas (tracejado)
            </button>
            <button
              onClick={() => setYoyMetrics(m => ({ ...m, saidas: !m.saidas }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${yoyMetrics.saidas ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
            >
              Saídas (sólido)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {yoyAnalysis.availableYears.map(year => (
              <button
                key={year}
                onClick={() => toggleYoyYear(year)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedYoyYears.includes(year) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={yoyAnalysis.chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="monthName" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '20px', fontWeight: 600 }} />

            {selectedYoyYears.map((year, idx) => {
              const color = YEAR_COLORS[idx % YEAR_COLORS.length];
              return (
                <Fragment key={year}>
                  {yoyMetrics.entradas && (
                    <Line type="monotone" dataKey={`${year}_entradas`} name={`Entradas ${year}`} stroke={color} strokeWidth={2.5} strokeDasharray="6 6" dot={{ r: 3, fill: color }} activeDot={{ r: 6 }} />
                  )}
                  {yoyMetrics.saidas && (
                    <Line type="monotone" dataKey={`${year}_saidas`} name={`Saídas ${year}`} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} activeDot={{ r: 7 }} />
                  )}
                </Fragment>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YoySeasonalityCard;
