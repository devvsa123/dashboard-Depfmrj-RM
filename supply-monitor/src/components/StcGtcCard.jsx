import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock } from 'lucide-react';
import InfoButton from './InfoButton';

const TYPE_LABEL = { STC: 'STC', GTC: 'GTC' };
const TYPE_COLOR = { STC: '#6366f1', GTC: '#f59e0b' };

// Tempo total do processo (liberação -> expedição) segmentado por tipo de
// documento — permite comparar se RMs com GTC demoram mais/menos que STC.
const StcGtcCard = ({ stcGtcAnalysis }) => {
  const { groups, hasData } = stcGtcAnalysis;

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Tempo Total do Processo: STC x GTC</h3>
        <InfoButton
          title="Liberação até Expedição"
          description="Tempo total (em dias corridos) desde a entrada até a expedição de pedidos finalizados, separado entre RMs identificadas por STC (ex: 003/2026) e por GTC (ex: GTC 002/2026)."
        />
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400 italic text-center py-10">Sem pedidos expedidos com STC/GTC identificado no período.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="grid grid-cols-2 gap-4">
            {groups.map(g => (
              <div key={g.type} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: TYPE_COLOR[g.type] }}>{TYPE_LABEL[g.type]}</p>
                <p className="text-2xl font-black text-slate-800">{g.count > 0 ? g.avgDays : '-'} <span className="text-xs text-slate-400 font-bold">dias (média)</span></p>
                <p className="text-xs text-slate-400 font-medium mt-1">Mediana: {g.count > 0 ? g.medianDays : '-'} dias · {g.count} pedido{g.count === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groups} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} unit="d" />
                <YAxis dataKey="type" type="category" width={40} tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} />
                <Tooltip formatter={(v) => [`${v} dias`, 'Média']} />
                <Bar dataKey="avgDays" radius={[0, 8, 8, 0]} barSize={28}>
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

export default StcGtcCard;
