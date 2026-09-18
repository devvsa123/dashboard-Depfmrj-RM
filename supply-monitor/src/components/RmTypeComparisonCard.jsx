import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { GitCompareArrows } from 'lucide-react';
import InfoButton from './InfoButton';

const TYPE_LABEL = { RMT: 'RMT', RMC: 'RMC' };
const TYPE_COLOR = { RMT: '#0ea5e9', RMC: '#8b5cf6' };

// Compara lado a lado o desempenho de RMT e RMC no período selecionado:
// volume de entrada, tempo médio de atendimento e nível de serviço.
const RmTypeComparisonCard = ({ rmTypeComparison }) => {
  const { groups, hasData } = rmTypeComparison;

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 break-inside-avoid">
      <div className="flex items-center gap-2 mb-6">
        <GitCompareArrows className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Comparativo por Tipo de RM: RMT x RMC</h3>
        <InfoButton
          title="RMT x RMC"
          description="Compara o volume de entrada, o tempo médio de atendimento e o nível de serviço (SLA) de cada tipo de Requisição de Material dentro do período selecionado no dashboard."
        />
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400 italic text-center py-10">Sem pedidos de RMT/RMC no período selecionado.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="grid grid-cols-2 gap-4">
            {groups.map(g => (
              <div key={g.type} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: TYPE_COLOR[g.type] }}>{TYPE_LABEL[g.type]}</p>
                <p className="text-2xl font-black text-slate-800">{g.entradas} <span className="text-xs text-slate-400 font-bold">entradas</span></p>
                <p className="text-xs text-slate-400 font-medium mt-1">{g.share != null ? `${g.share}% do volume do período` : 'Sem entradas no período'}</p>
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
                  <p className="text-xs text-slate-500 font-bold">{g.slaRate != null ? `${g.slaRate}% dentro do prazo` : 'Sem expedições no período'}</p>
                  <p className="text-xs text-slate-400 font-medium">{g.avgLeadTime != null ? `${g.avgLeadTime} dias em média até expedir` : '-'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groups} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} unit="%" domain={[0, 100]} />
                <YAxis dataKey="type" type="category" width={40} tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} />
                <Tooltip formatter={(v) => [v != null ? `${v}%` : 'Sem dados', 'SLA no prazo']} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="slaRate" name="Nível de Serviço" radius={[0, 8, 8, 0]} barSize={28}>
                  {groups.map(g => <Cell key={g.type} fill={TYPE_COLOR[g.type]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default RmTypeComparisonCard;
