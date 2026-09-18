import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, TrendingUp, FileWarning, CheckCircle2, FileStack } from 'lucide-react';
import InfoButton from './InfoButton';
import StcGtcPendingModal from './StcGtcPendingModal';

const TYPE_LABEL = { STC: 'STC', GTC: 'GTC' };
const TYPE_COLOR = { STC: '#6366f1', GTC: '#f59e0b' };

// Tempo total do processo (liberação -> expedição) por pedido, sua
// tendência mês a mês, e a situação dos DOCUMENTOS STC/GTC — um mesmo
// documento agrupa vários pedidos, então a contagem "quantos STC/GTC eu
// tenho" precisa ser sobre valores distintos, não sobre linhas da planilha.
const StcGtcCard = ({ stcGtcAnalysis, handleDownloadExcel }) => {
  const [pendingType, setPendingType] = useState(null);
  const { groups, monthlyTrend, documents, pendingOrders, hasData } = stcGtcAnalysis;

  const hasDocuments = documents.some(d => d.totalDocuments > 0);
  const agingChartData = documents.length
    ? documents[0].agingBuckets.map((bucket, idx) => ({
        name: bucket.name,
        STC: documents[0].agingBuckets[idx]?.count || 0,
        GTC: documents[1].agingBuckets[idx]?.count || 0
      }))
    : [];

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

      {!hasData && !hasDocuments ? (
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
                    <p className="text-2xl font-black text-slate-800">{g.pedidoCount > 0 ? g.avgDays : '-'} <span className="text-xs text-slate-400 font-bold">dias (média)</span></p>
                    <p className="text-xs text-slate-400 font-medium mt-1">Mediana: {g.pedidoCount > 0 ? g.medianDays : '-'} dias</p>
                    <p className="text-xs text-slate-500 font-bold mt-2 pt-2 border-t border-slate-200">{g.documentCount} documento{g.documentCount === 1 ? '' : 's'} · {g.pedidoCount} pedido{g.pedidoCount === 1 ? '' : 's'}</p>
                    {g.onTimeRate != null && <p className="text-xs text-slate-400 font-medium">{g.onTimeRate}% expedidos dentro do prazo</p>}
                  </div>
                ))}
              </div>
              <div className="h-[160px] w-full">
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
              <FileStack size={14} className="text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Situação dos Documentos (Agora)</p>
              <InfoButton
                title="Situação dos Documentos"
                description="Cada STC ou GTC pode agrupar vários pedidos. Concluído: todos os pedidos do documento já foram expedidos. Parcial: parte já saiu, parte ainda não. Pendente: nenhum pedido do documento foi expedido ainda. Documentos 100% cancelados não entram na contagem."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {documents.map(doc => (
                <div key={doc.type} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: TYPE_COLOR[doc.type] }}>{TYPE_LABEL[doc.type]} · {doc.totalDocuments} documento{doc.totalDocuments === 1 ? '' : 's'}</p>
                    {doc.completionRate != null && <span className="text-[10px] font-bold text-slate-400">{doc.completionRate}% concluído</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <p className="text-lg font-black text-emerald-700">{doc.completedDocuments}</p>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase">Concluídos</p>
                    </div>
                    <button
                      onClick={() => doc.partialDocuments > 0 && setPendingType(doc.type)}
                      disabled={doc.partialDocuments === 0}
                      className={`p-2.5 rounded-xl border text-center transition-all ${doc.partialDocuments > 0 ? 'bg-amber-50 border-amber-100 hover:shadow-sm cursor-pointer' : 'bg-slate-100 border-slate-100 cursor-default'}`}
                    >
                      <p className={`text-lg font-black ${doc.partialDocuments > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{doc.partialDocuments}</p>
                      <p className={`text-[9px] font-bold uppercase ${doc.partialDocuments > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Parciais</p>
                    </button>
                    <button
                      onClick={() => doc.pendingDocuments > 0 && setPendingType(doc.type)}
                      disabled={doc.pendingDocuments === 0}
                      className={`p-2.5 rounded-xl border text-center transition-all ${doc.pendingDocuments > 0 ? 'bg-red-50 border-red-100 hover:shadow-sm cursor-pointer' : 'bg-slate-100 border-slate-100 cursor-default'}`}
                    >
                      <p className={`text-lg font-black ${doc.pendingDocuments > 0 ? 'text-red-700' : 'text-slate-400'}`}>{doc.pendingDocuments}</p>
                      <p className={`text-[9px] font-bold uppercase ${doc.pendingDocuments > 0 ? 'text-red-600' : 'text-slate-400'}`}>Pendentes</p>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-3">
                    {doc.openDocuments > 0
                      ? `${doc.pedidosPendentesCount} pedido(s) em aberto · idade média de ${doc.avgAgePendentes} dias · mais antigo com ${doc.oldestPendente?.daysOpen} dias`
                      : 'Nenhum pedido em aberto nestes documentos.'}
                  </p>
                  {doc.daysToClear != null && doc.openDocuments > 0 && (
                    <p className="text-xs text-slate-400 font-medium">No ritmo do período selecionado, faltam ~{doc.daysToClear} dias para zerar os pendentes de {TYPE_LABEL[doc.type]}.</p>
                  )}
                </div>
              ))}
            </div>
            {documents.every(d => d.openDocuments === 0) && documents.some(d => d.totalDocuments > 0) && (
              <div className="flex items-center gap-2 mt-3 text-emerald-600 text-xs font-bold">
                <CheckCircle2 size={14} /> Nenhum documento pendente — tudo expedido ou cancelado.
              </div>
            )}
          </div>

          {agingChartData.some(d => d.STC > 0 || d.GTC > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileWarning size={14} className="text-slate-400" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Envelhecimento dos Documentos Pendentes</p>
                <InfoButton title="Envelhecimento" description="Distribui os documentos STC/GTC ainda em aberto (parciais ou pendentes) por tempo desde a entrada do seu pedido mais antigo não expedido — o item que está de fato travando o documento. Cada documento conta uma única vez, mesmo que tenha vários pedidos pendentes." />
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} allowDecimals={false} />
                    <Tooltip /><Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="STC" fill={TYPE_COLOR.STC} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="GTC" fill={TYPE_COLOR.GTC} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StcGtcCard;
