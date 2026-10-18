import { Gauge, Info } from 'lucide-react';
import InfoButton from '../InfoButton';
import { DIAS_CURTOS, formatarBr } from '../../utils/programacao/semana';

// Capacidade medida no histórico, por dia da semana. O número é sugestão —
// o programador conhece a semana que vem melhor do que a média conhece.
const CapacidadePanel = ({ capacidade, janelaDias, setJanelaDias, janelas, grade, overrides, definirOverride }) => {
  if (!capacidade) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <p className="text-sm text-slate-400 italic">Sem histórico suficiente para medir a capacidade.</p>
      </div>
    );
  }

  const max = Math.max(...[1, 2, 3, 4, 5].map(d => capacidade.porDiaSemana[d] || 0), 1);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Capacidade por Dia da Semana</h3>
          <InfoButton
            title="De onde sai esse número"
            description="É a média de RMs distintas que saíram em cada dia da semana na janela escolhida, contando os dias parados como zero. Usamos média, e não mediana, porque a operação trabalha em batelada: há segundas com centenas de RMs e segundas sem nenhuma. A mediana de cada dia somaria cerca de 275 RMs por semana, bem abaixo da vazão real, e a semana sairia subprogramada. O número é só o ponto de partida: qualquer dia pode ser sobrescrito na mão, e o documento registra quando foi."
          />
        </div>
        <div className="flex gap-2">
          {janelas.map(j => (
            <button
              key={j.key}
              onClick={() => setJanelaDias(j.dias)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${janelaDias === j.dias ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacidade Semanal</p>
            <p className="text-2xl font-black text-slate-900 leading-none mt-1">{capacidade.totalSemanal} <span className="text-sm font-bold text-slate-400">RMs</span></p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dia Mais Forte</p>
            <p className="text-2xl font-black text-emerald-600 leading-none mt-1">{capacidade.diaMaisForte}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dia Mais Fraco</p>
            <p className="text-2xl font-black text-amber-600 leading-none mt-1">{capacidade.diaMaisFraco}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Info size={13} /> medido de {formatarBr(capacidade.inicio)} a {formatarBr(capacidade.fim)}
          </div>
        </div>

        <div className="space-y-2">
          {grade.map(slot => {
            const padrao = capacidade.porDiaSemana[new Date(slot.dia + 'T00:00:00Z').getUTCDay()] || 0;
            const temOverride = overrides[slot.dia] !== undefined;
            return (
              <div key={slot.dia} className={`flex items-center gap-3 p-3 rounded-xl border ${slot.bloqueio ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className="w-24 shrink-0 font-bold text-slate-700 text-sm">
                  {DIAS_CURTOS[new Date(slot.dia + 'T00:00:00Z').getUTCDay()]} {formatarBr(slot.dia).slice(0, 5)}
                </span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${slot.bloqueio ? 'bg-red-300' : temOverride ? 'bg-amber-400' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, (slot.capacidade / max) * 100)}%` }}
                  />
                </div>
                {slot.bloqueio ? (
                  <span className="text-xs font-bold text-red-600 w-56 text-right truncate" title={slot.bloqueio.motivo}>
                    sem separação — {slot.bloqueio.motivo}
                  </span>
                ) : (
                  <div className="flex items-center gap-2 w-56 justify-end">
                    <input
                      type="number"
                      min="0"
                      value={overrides[slot.dia] ?? ''}
                      placeholder={String(padrao)}
                      onChange={e => definirOverride(slot.dia, e.target.value)}
                      className={`w-20 px-2 py-1 rounded-lg border text-sm font-bold text-right outline-none ${temOverride ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}
                    />
                    <span className="text-[11px] text-slate-400 font-medium w-24">
                      {temOverride ? `medido: ${padrao}` : 'RMs (medido)'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CapacidadePanel;
