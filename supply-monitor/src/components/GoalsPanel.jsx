import { useState } from 'react';
import { Target, Settings2, Check } from 'lucide-react';
import InfoButton from './InfoButton';

const STATUS_COLOR = {
  good: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-600' },
  critical: { bar: 'bg-red-500', text: 'text-red-600' }
};

const GoalMeter = ({ label, value, target, unit, higherIsBetter }) => {
  if (value == null) {
    return (
      <div>
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
          <span className="text-xs font-black text-slate-300">Sem dados no período</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden" />
      </div>
    );
  }

  const ratio = higherIsBetter ? (value / target) * 100 : (target / Math.max(value, 0.0001)) * 100;
  const pct = Math.max(0, Math.min(ratio, 100));
  const status = ratio >= 100 ? 'good' : ratio >= 75 ? 'warning' : 'critical';
  const colors = STATUS_COLOR[status];

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-black ${colors.text}`}>
          {value}{unit} <span className="text-slate-400 font-medium">/ meta {target}{unit}</span>
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// Metas gerenciais editáveis + barras de progresso mostrando se a operação
// está dentro do combinado (SLA, idade da fila, pedido mais antigo).
const GoalsPanel = ({ goals, updateGoals, slaAtual, avgAge, oldest, stcGtcAnalysis }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(goals);

  const stcGroup = stcGtcAnalysis?.groups?.find(g => g.type === 'STC');
  const gtcGroup = stcGtcAnalysis?.groups?.find(g => g.type === 'GTC');
  const stcDoc = stcGtcAnalysis?.documents?.find(d => d.type === 'STC');
  const gtcDoc = stcGtcAnalysis?.documents?.find(d => d.type === 'GTC');

  const startEditing = () => { setDraft(goals); setIsEditing(true); };
  const saveEditing = () => {
    updateGoals({
      slaTarget: Number(draft.slaTarget) || goals.slaTarget,
      maxBacklogAge: Number(draft.maxBacklogAge) || goals.maxBacklogAge,
      maxOldestOrder: Number(draft.maxOldestOrder) || goals.maxOldestOrder,
      stcSlaTarget: Number(draft.stcSlaTarget) || goals.stcSlaTarget,
      gtcSlaTarget: Number(draft.gtcSlaTarget) || goals.gtcSlaTarget,
      docCompletionTarget: Number(draft.docCompletionTarget) || goals.docCompletionTarget
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Target className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Metas e Progresso</h3>
          <InfoButton
            title="Como funciona"
            description="Cada barra compara o valor atual com a meta definida abaixo. Barra cheia e verde significa que a meta foi atingida; quanto mais vazia e mais para o vermelho, mais distante estamos do combinado. Você pode ajustar as metas a qualquer momento em 'Editar metas'."
          />
        </div>
        {isEditing ? (
          <button onClick={saveEditing} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
            <Check size={14} /> Salvar
          </button>
        ) : (
          <button onClick={startEditing} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">
            <Settings2 size={14} /> Editar metas
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Meta de Nível de Serviço (%)</span>
              <input type="number" value={draft.slaTarget} onChange={e => setDraft(d => ({ ...d, slaTarget: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
            </label>
            <label className="block">
              <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Idade média da fila (dias)</span>
              <input type="number" value={draft.maxBacklogAge} onChange={e => setDraft(d => ({ ...d, maxBacklogAge: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
            </label>
            <label className="block">
              <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Pedido mais antigo (dias)</span>
              <input type="number" value={draft.maxOldestOrder} onChange={e => setDraft(d => ({ ...d, maxOldestOrder: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
            </label>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Metas por Tipo de Documento (STC/GTC)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Meta de SLA — STC (%)</span>
                <input type="number" value={draft.stcSlaTarget} onChange={e => setDraft(d => ({ ...d, stcSlaTarget: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </label>
              <label className="block">
                <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Meta de SLA — GTC (%)</span>
                <input type="number" value={draft.gtcSlaTarget} onChange={e => setDraft(d => ({ ...d, gtcSlaTarget: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </label>
              <label className="block">
                <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Conclusão mínima de documentos (%)</span>
                <input type="number" value={draft.docCompletionTarget} onChange={e => setDraft(d => ({ ...d, docCompletionTarget: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GoalMeter label="Nível de Serviço" value={slaAtual} target={goals.slaTarget} unit="%" higherIsBetter />
            <GoalMeter label="Idade Média da Fila" value={avgAge} target={goals.maxBacklogAge} unit="d" higherIsBetter={false} />
            <GoalMeter label="Pedido Mais Antigo" value={oldest} target={goals.maxOldestOrder} unit="d" higherIsBetter={false} />
          </div>
          {stcGtcAnalysis && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Metas por Tipo de Documento (STC/GTC)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <GoalMeter label="SLA — STC" value={stcGroup?.onTimeRate ?? null} target={goals.stcSlaTarget} unit="%" higherIsBetter />
                <GoalMeter label="SLA — GTC" value={gtcGroup?.onTimeRate ?? null} target={goals.gtcSlaTarget} unit="%" higherIsBetter />
                <GoalMeter label="Conclusão — STC" value={stcDoc?.completionRate ?? null} target={goals.docCompletionTarget} unit="%" higherIsBetter />
                <GoalMeter label="Conclusão — GTC" value={gtcDoc?.completionRate ?? null} target={goals.docCompletionTarget} unit="%" higherIsBetter />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalsPanel;
