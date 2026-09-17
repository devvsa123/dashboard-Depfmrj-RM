import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, TrendingUp, FileWarning, CheckCircle2 } from 'lucide-react';
import InfoButton from './InfoButton';
import StcGtcPendingModal from './StcGtcPendingModal';

const TYPE_LABEL = { STC: 'STC', GTC: 'GTC' };
const TYPE_COLOR = { STC: '#6366f1', GTC: '#f59e0b' };

// Tempo total do processo (liberação -> expedição) segmentado por tipo de
// documento, sua tendência mês a mês, a taxa de conclusão e o que ainda
// está pendente — permite comparar se RMs com GTC demoram mais/menos que
// STC e se a fila de documentos está sob controle.
const StcGtcCard = ({ stcGtcAnalysis, handleDownloadExcel }) => {
  const [pendingType, setPendingType] = useState(null);
  const { groups, monthlyTrend, pending, pendingOrders, completionRate, hasData } = stcGtcAnalysis;

  const hasPending = pending.some(p => p.count > 0);

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <StcGtcPendingModal pendingType={pendingType} setPendingType={setPendingType} pendingOrders={pendingOrders} handleDownloadExcel={handleDownloadExcel} />

      <div className="flex items-center gap-2 mb-6">
        <Clock className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Tempo Total do Processo: STC x GTC</h3>
        <InfoButton
          title="Liberação até Expedição"
          description="Tempo total (em dias corridos) desde a entrada até a expedição de pedidos finalizados, separado entre RMs identificadas por STC (ex: 003/2026) e por GTC (ex: GTC 002/2026). RMs sem nenhum dos dois não entram nesta análise — a fila geral está na aba 'RM em processamento'."
        />
      </div>

      {!hasData && !hasPending ? (
        <p className="text-sm text-slate-400 italic text-center py-10">Sem pedidos com STC/GTC identificado.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tempo Médio no Período Selecionado</p>
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
              <div className="h-[140px] w-full">
                {hasData ? (
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
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Sem pedidos expedidos no período</div>
                )}
              </div>
            </div>
          </div>

          {monthlyTrend.length > 1 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-slate-400" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendência Histórica (Média Mensal)</p>
                <InfoButton title="Tendência Histórica" description="Média de dias de processo por mês de expedição, dentro do período selecionado no dashboard. Ajuda a ver se o tempo de atendimento está melhorando ou piorando ao longo do tempo, e não só no recorte atual." />
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
                    <YAxis unit="d" tick={{ fontSize: 10 }} axisLine={false} />
                    <Tooltip formatter={(v) => (v === null ? ['-', ''] : [`${v} dias`, ''])} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="STC_avg" name="STC" stroke={TYPE_COLOR.STC} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="GTC_avg" name="GTC" stroke={TYPE_COLOR.GTC} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileWarning size={14} className="text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes Agora (com STC/GTC, ainda não expedidos)</p>
              <InfoButton title="Pendentes" description="Pedidos que já têm STC ou GTC atribuído, mas cujo status ainda não é 'Expedido' (cancelados não entram aqui). Clique em um cartão para ver a lista completa." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map(p => (
                <button
                  key={p.type}
                  onClick={() => p.count > 0 && setPendingType(p.type)}
                  disabled={p.count === 0}
                  className={`text-left p-4 rounded-2xl border transition-all ${p.count > 0 ? 'border-amber-200 bg-amber-50 hover:shadow-sm cursor-pointer' : 'border-slate-100 bg-slate-50 cursor-default'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: TYPE_COLOR[p.type] }}>{TYPE_LABEL[p.type]} Pendentes</p>
                    {completionRate.find(c => c.type === p.type)?.rate != null && (
                      <span className="text-[10px] font-bold text-slate-400">{completionRate.find(c => c.type === p.type).rate}% concluído</span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-slate-800 mt-1">{p.count} <span className="text-xs text-slate-400 font-bold">pedido{p.count === 1 ? '' : 's'}</span></p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{p.count > 0 ? `Idade média de ${p.avgAge} dias · mais antigo com ${p.oldestOrder?.daysOpen} dias` : 'Nenhum pendente no momento'}</p>
                </button>
              ))}
            </div>
            {!hasPending && (
              <div className="flex items-center gap-2 mt-3 text-emerald-600 text-xs font-bold">
                <CheckCircle2 size={14} /> Nenhum documento pendente — tudo expedido ou cancelado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StcGtcCard;
